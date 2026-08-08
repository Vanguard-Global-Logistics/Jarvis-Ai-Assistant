#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
import os
import wave
from pathlib import Path
from typing import Iterable

import numpy as np

HOME = Path.home()
LOCK_HOME = HOME / ".jarvis-owner-voice"
PROFILE_PATH = LOCK_HOME / "owner-profile.npz"
META_PATH = LOCK_HOME / "owner-profile.json"
MODEL_PATH = LOCK_HOME / "models" / "voxceleb_CAM++.onnx"

SAMPLE_RATE = 16000
MODEL_SHA256 = "b50810498b5bcf5773d086f6993d344476bd0c88b566a41e8d801aaf8461efad"

DEFAULT_STRONG_THRESHOLD = float(
    os.environ.get("JARVIS_OWNER_VOICE_STRONG_THRESHOLD", "0.58")
)
DEFAULT_WAKE_ASSIST_THRESHOLD = float(
    os.environ.get("JARVIS_OWNER_VOICE_WAKE_ASSIST_THRESHOLD", "0.48")
)
DEFAULT_REJECT_THRESHOLD = float(
    os.environ.get("JARVIS_OWNER_VOICE_REJECT_THRESHOLD", "0.40")
)


def _l2(x: np.ndarray) -> np.ndarray:
    x = np.asarray(x, dtype=np.float32).reshape(-1)
    norm = float(np.linalg.norm(x))
    if not math.isfinite(norm) or norm <= 1e-8:
        raise ValueError("invalid zero speaker embedding")
    return x / norm


def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(_l2(a), _l2(b)))


def _safe_permissions(path: Path) -> None:
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def _read_wav_pcm(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as wf:
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        rate = wf.getframerate()
        frames = wf.readframes(wf.getnframes())
    if channels != 1 or width != 2 or rate != SAMPLE_RATE:
        raise ValueError(
            f"{path.name}: enrollment WAV must be 16kHz mono signed 16-bit PCM"
        )
    return np.frombuffer(frames, dtype="<i2").astype(np.float32)


def _pcm_bytes_to_samples(pcm: bytes) -> np.ndarray:
    if len(pcm) < SAMPLE_RATE * 2 // 2:
        raise ValueError("speaker sample is too short")
    return np.frombuffer(pcm, dtype="<i2").astype(np.float32)


class CamPlusEmbedder:
    """Lightweight WeSpeaker CAM++ ONNX embedding runtime.

    Preprocessing follows WeSpeaker's published ONNX example:
    80-bin Kaldi fbank, 25ms frame, 10ms shift, no dither, Hamming window,
    followed by per-utterance cepstral mean normalization.
    """

    def __init__(self, model_path: Path = MODEL_PATH) -> None:
        if not model_path.exists():
            raise FileNotFoundError(
                f"Owner Voice Lock model missing: {model_path}. "
                "Run INSTALL-R13-OWNER-VOICE-LOCK.command."
            )

        digest = hashlib.sha256(model_path.read_bytes()).hexdigest()
        if digest != MODEL_SHA256:
            raise RuntimeError(
                "Owner Voice Lock model SHA-256 mismatch; refusing unverified model."
            )

        try:
            import onnxruntime as ort
        except Exception as exc:
            raise RuntimeError("onnxruntime is not installed") from exc
        try:
            import kaldi_native_fbank as knf
        except Exception as exc:
            raise RuntimeError("kaldi-native-fbank is not installed") from exc

        self.knf = knf
        opts = ort.SessionOptions()
        # Do not let the verifier compete aggressively with Whisper/Ollama on the
        # 8 GB M3. The model is small and latency is still low with two threads.
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 2
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        self.session = ort.InferenceSession(
            str(model_path),
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name
        output_names = [o.name for o in self.session.get_outputs()]
        self.output_name = "embs" if "embs" in output_names else output_names[0]

    def _features(self, samples: np.ndarray) -> np.ndarray:
        if samples.size < int(SAMPLE_RATE * 0.70):
            raise ValueError("speaker sample needs at least 0.7 seconds of audio")

        opts = self.knf.FbankOptions()
        opts.frame_opts.dither = 0.0
        opts.mel_opts.num_bins = 80

        # Match WeSpeaker's published kaldi.fbank settings where supported.
        for name, value in (
            ("frame_length_ms", 25.0),
            ("frame_shift_ms", 10.0),
            ("window_type", "hamming"),
            ("snip_edges", True),
        ):
            if hasattr(opts.frame_opts, name):
                setattr(opts.frame_opts, name, value)

        fbank = self.knf.OnlineFbank(opts)
        # WeSpeaker multiplies normalized waveform by 2^15 before Kaldi fbank.
        # PCM16 samples are already in that numeric range.
        fbank.accept_waveform(SAMPLE_RATE, samples.astype(np.float32).tolist())
        try:
            fbank.input_finished()
        except AttributeError:
            pass

        count = int(fbank.num_frames_ready)
        if count < 20:
            raise ValueError("not enough valid frames for speaker verification")
        feats = np.stack(
            [np.asarray(fbank.get_frame(i), dtype=np.float32) for i in range(count)]
        )
        # WeSpeaker ONNX demo applies CMN without CVN.
        feats -= feats.mean(axis=0, keepdims=True)
        return feats[None, :, :].astype(np.float32)

    def embed_samples(self, samples: np.ndarray) -> np.ndarray:
        feats = self._features(samples)
        result = self.session.run(
            [self.output_name],
            {self.input_name: feats},
        )[0]
        return _l2(np.asarray(result, dtype=np.float32).reshape(-1))

    def embed_pcm(self, pcm: bytes) -> np.ndarray:
        return self.embed_samples(_pcm_bytes_to_samples(pcm))

    def embed_wav(self, path: Path) -> np.ndarray:
        return self.embed_samples(_read_wav_pcm(path))


def build_profile(
    wav_paths: Iterable[Path],
    owner_name: str = "William",
) -> dict:
    embedder = CamPlusEmbedder()
    embeddings = []
    names = []

    for path in wav_paths:
        emb = embedder.embed_wav(Path(path))
        embeddings.append(emb)
        names.append(Path(path).name)

    if len(embeddings) < 4:
        raise ValueError("Owner Voice Lock requires at least four enrollment samples")

    matrix = np.stack(embeddings).astype(np.float32)

    # First-pass centroid and outlier rejection. A contaminated enrollment clip
    # should not poison the permanent owner profile.
    centroid0 = _l2(matrix.mean(axis=0))
    initial_scores = np.asarray([cosine(e, centroid0) for e in matrix])
    median_score = float(np.median(initial_scores))
    keep_floor = max(0.50, median_score - 0.16)
    keep = initial_scores >= keep_floor

    if int(keep.sum()) < 4:
        raise RuntimeError(
            "Enrollment samples were not consistent enough. "
            "Re-enroll in a quieter position and speak close to the Mac."
        )

    kept = matrix[keep]
    centroid = _l2(kept.mean(axis=0))

    # Leave-one-out genuine-speaker calibration.
    loo_scores = []
    if len(kept) > 1:
        for i in range(len(kept)):
            others = np.delete(kept, i, axis=0)
            other_centroid = _l2(others.mean(axis=0))
            loo_scores.append(cosine(kept[i], other_centroid))
    else:
        loo_scores = [cosine(kept[0], centroid)]

    genuine_floor = float(np.percentile(loo_scores, 10))
    # Conservative but adaptive threshold. We do not have impostor samples, so
    # we never lower strong-owner acceptance below 0.54 automatically.
    strong_threshold = max(
        0.54,
        min(0.68, genuine_floor - 0.08),
    )
    wake_assist_threshold = max(
        DEFAULT_WAKE_ASSIST_THRESHOLD,
        min(strong_threshold - 0.05, genuine_floor - 0.15),
    )
    reject_threshold = min(
        DEFAULT_REJECT_THRESHOLD,
        wake_assist_threshold - 0.06,
    )

    LOCK_HOME.mkdir(parents=True, exist_ok=True)
    os.chmod(LOCK_HOME, 0o700)
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)

    np.savez_compressed(
        PROFILE_PATH,
        centroid=centroid.astype(np.float32),
        samples=kept.astype(np.float32),
    )
    _safe_permissions(PROFILE_PATH)

    meta = {
        "schema": 1,
        "owner_name": owner_name,
        "model": "Wespeaker/wespeaker-voxceleb-campplus",
        "model_sha256": MODEL_SHA256,
        "embedding_dimension": int(centroid.size),
        "enrollment_samples_total": len(embeddings),
        "enrollment_samples_kept": int(keep.sum()),
        "enrollment_scores": [round(float(x), 4) for x in initial_scores],
        "leave_one_out_scores": [round(float(x), 4) for x in loo_scores],
        "strong_threshold": round(float(strong_threshold), 4),
        "wake_assist_threshold": round(float(wake_assist_threshold), 4),
        "reject_threshold": round(float(reject_threshold), 4),
        "raw_audio_retained": False,
        "security_note": (
            "Voice identification is an attention filter, not a sole credential "
            "for security, money, AEGIS, destructive, or privileged actions."
        ),
    }
    META_PATH.write_text(json.dumps(meta, indent=2, sort_keys=True), encoding="utf-8")
    _safe_permissions(META_PATH)
    return meta


class OwnerVoiceLock:
    def __init__(self) -> None:
        if not PROFILE_PATH.exists() or not META_PATH.exists():
            raise FileNotFoundError(
                "Owner Voice Lock is not enrolled. Run ENROLL-WILLIAM-VOICE.command."
            )
        with np.load(PROFILE_PATH, allow_pickle=False) as data:
            self.centroid = _l2(data["centroid"])
            self.samples = np.asarray(data["samples"], dtype=np.float32)
        self.meta = json.loads(META_PATH.read_text(encoding="utf-8"))
        self.strong_threshold = float(
            self.meta.get("strong_threshold", DEFAULT_STRONG_THRESHOLD)
        )
        self.wake_assist_threshold = float(
            self.meta.get("wake_assist_threshold", DEFAULT_WAKE_ASSIST_THRESHOLD)
        )
        self.reject_threshold = float(
            self.meta.get("reject_threshold", DEFAULT_REJECT_THRESHOLD)
        )
        self.embedder = CamPlusEmbedder()

    def score_embedding(self, emb: np.ndarray) -> float:
        emb = _l2(emb)
        centroid_score = cosine(emb, self.centroid)
        sample_scores = sorted(
            (cosine(emb, sample) for sample in self.samples),
            reverse=True,
        )
        # Multi-sample enrollment helps across volume/noise/mic variation. Avoid
        # trusting one accidental high match: blend centroid with top-two samples.
        if len(sample_scores) >= 2:
            top_support = 0.5 * (sample_scores[0] + sample_scores[1])
        else:
            top_support = sample_scores[0]
        return float(0.55 * centroid_score + 0.45 * top_support)

    def verify_pcm(self, pcm: bytes) -> dict:
        import time
        started = time.perf_counter()
        emb = self.embedder.embed_pcm(pcm)
        score = self.score_embedding(emb)

        if score >= self.strong_threshold:
            decision = "owner"
        elif score < self.reject_threshold:
            decision = "other"
        else:
            decision = "uncertain"

        return {
            "decision": decision,
            "score": round(score, 4),
            "strong_threshold": self.strong_threshold,
            "wake_assist_threshold": self.wake_assist_threshold,
            "reject_threshold": self.reject_threshold,
            "seconds": round(time.perf_counter() - started, 3),
        }

    def wake_assisted_accept(self, score: float, heard_wake: bool) -> bool:
        return bool(heard_wake and score >= self.wake_assist_threshold)
