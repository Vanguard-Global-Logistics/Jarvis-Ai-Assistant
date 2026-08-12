# Ollama, step by step

The goal: a model running on your MacBook that Jarvis talks to instead of a paid
API. About 20 minutes, most of it downloading.

**Rule for every command here: paste the line exactly, and never add a `#`
comment to the end of it.** Your zsh does not treat `#` as a comment, so it gets
passed to the program as an argument. That is what silently broke `npm run
verify` once already.

---

## Step 1 — How much memory do you have?

```bash
npm run diagnostics
```

Look for the `memory:` line near the top. It decides which model you can run,
because on Apple Silicon the GPU shares the same memory as everything else.

| Your memory | Pull this   | Roughly |
| ----------- | ----------- | ------- |
| 8 GB        | `qwen3:4b`  | 2.5 GB  |
| 16 GB       | `qwen3:8b`  | 5 GB    |
| 24 GB+      | `qwen3:14b` | 9 GB    |

**Do not pull a bigger one than the table says.** macOS will start swapping to
disk and the model will feel broken rather than slow, and you will conclude local
models are useless when the real problem was the size.

Everything below assumes `qwen3:8b`. If your row says something different,
substitute it everywhere — including in the `.env` file in Step 4.

## Step 2 — Install Ollama and start it

```bash
brew install ollama
```

```bash
ollama serve &
```

The `&` matters. Without it, `ollama serve` holds the terminal forever and
everything you type afterwards gets swallowed — the same trap `caffeinate` set.

You should get your prompt back within a second or two. Some startup logging is
normal.

## Step 3 — Download the model

```bash
ollama pull qwen3:8b
```

This is the slow part. It is a multi-gigabyte download and shows a progress bar.

**If it says the model was not found**, the tag has moved. Open
<https://ollama.com/library/qwen3>, take the newest tag closest to the size in
the table, and use that name for the rest of this document. Tell me which one you
actually used.

Then confirm Ollama is answering:

```bash
curl http://127.0.0.1:11434/v1/models
```

Success is a blob of JSON with your model's name in it. If you get
`connection refused`, Step 2 did not stay running — run `ollama serve &` again.

## Step 4 — Tell Jarvis about it

Run this exactly as written. It is one command; the `EOF` lines are part of it.

```bash
cd ~/Jarvis-Ai-Assistant
cat > .env <<'EOF'
JARVIS_LOCAL_MODEL_URL=http://127.0.0.1:11434
JARVIS_LOCAL_MODEL=qwen3:8b
EOF
```

Then check Jarvis agrees:

```bash
npm run diagnostics
```

You are looking for exactly two lines:

```
- provider that would be used: **local**
- loopback (required, ADR 0015): YES
```

If it says `mock`, the `.env` did not land. If it says anything other than `YES`
for loopback, stop and send me the output — the app will refuse to start, on
purpose.

## Step 5 — Talk to it

```bash
npm run dev:desktop
```

In the app:

1. Type **"Explain what a bill of lading is, in two sentences."** and send it.
2. Then type an idea into the box and click **Amplify**.

## Step 6 — What to send me

Copy this block, fill it in, send it back:

```
1. Which model I actually pulled:
   >

2. Did the reply have a blue "Local model" chip?
   >

3. THE ACTUAL REPLY TEXT (paste all of it — this is the one I need most):
   >

4. Amplify: did it produce the five-field card, or an error? Paste the wording
   either way. An error here is EXPECTED and is not a bug — small models are
   unreliable at strict JSON.
   >

5. Roughly how long did each take?
   >

6. Your gut: is this good enough for the family to use every day?
   >
```

Question 3 is the whole point. I can tell that it worked from a chip; I cannot
tell whether it is any _good_ without reading what it actually said.

---

## If you want to stop it later

```bash
pkill ollama
```

To make Jarvis go back to the mock provider, delete the `.env` file:

```bash
rm ~/Jarvis-Ai-Assistant/.env
```

Nothing is lost by doing either — the model stays downloaded and setting `.env`
back up takes ten seconds.
