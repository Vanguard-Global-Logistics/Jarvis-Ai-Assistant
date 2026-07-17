// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { accent, surface, text } from '../tokens/colors.js';
import { fontFamily, letterSpacing } from '../tokens/typography.js';
import { GlassPanel } from './GlassPanel.js';
import { SectionLabel } from './SectionLabel.js';
import { HexBadge } from './HexBadge.js';

/** jsdom's CSSOM normalizes color/property strings on write (e.g. hex →
 * rgb()). Rather than hard-code the normalized form, derive the expected
 * value the same way jsdom would, so assertions track real behavior instead
 * of a guessed serialization. */
function normalizedStyleValue(property: string, value: string): string {
  const probe = document.createElement('div');
  probe.style.setProperty(property, value);
  return probe.style.getPropertyValue(property);
}

afterEach(() => {
  cleanup();
});

describe('GlassPanel', () => {
  it('renders children', () => {
    render(<GlassPanel>panel content</GlassPanel>);
    expect(screen.getByText('panel content')).toBeTruthy();
  });

  it('applies the glass background, hairline border, and blur+fallback layers', () => {
    const { container } = render(<GlassPanel>content</GlassPanel>);
    const outer = container.firstElementChild as HTMLElement;

    expect(outer.style.borderTopWidth).toBe('1px');
    expect(outer.style.borderTopColor).toBe(
      normalizedStyleValue('border-top-color', surface.hairline),
    );

    const layers = Array.from(outer.children) as HTMLElement[];
    const fallbackLayer = layers.find(
      (el) =>
        el.style.backgroundColor === normalizedStyleValue('background-color', 'rgba(8,12,18,0.55)'),
    );
    const glassLayer = layers.find((el) => el.style.backdropFilter === 'blur(14px)');

    expect(fallbackLayer).toBeTruthy();
    expect(glassLayer).toBeTruthy();
    expect(glassLayer?.style.background).toBe(normalizedStyleValue('background', surface.glass));
  });

  it('renders a left border in the exact accent color when accentColor is set', () => {
    const { container } = render(<GlassPanel accentColor={accent.success}>content</GlassPanel>);
    const outer = container.firstElementChild as HTMLElement;

    expect(outer.style.borderLeftWidth).toBe('2px');
    expect(outer.style.borderLeftColor).toBe(
      normalizedStyleValue('border-left-color', accent.success),
    );
  });

  it('has no left accent border when accentColor is omitted', () => {
    const { container } = render(<GlassPanel>content</GlassPanel>);
    const outer = container.firstElementChild as HTMLElement;

    // Left border falls back to the uniform 1px hairline border, not a 2px accent.
    expect(outer.style.borderLeftWidth).toBe('1px');
    expect(outer.style.borderLeftColor).toBe(
      normalizedStyleValue('border-left-color', surface.hairline),
    );
  });
});

describe('SectionLabel', () => {
  it('renders uppercase mono text with the section-label letter spacing and color', () => {
    render(<SectionLabel>panel title</SectionLabel>);
    const el = screen.getByText('panel title');

    expect(el.style.textTransform).toBe('uppercase');
    expect(el.style.fontFamily).toBe(normalizedStyleValue('font-family', fontFamily.mono));
    expect(el.style.letterSpacing).toBe(
      normalizedStyleValue('letter-spacing', letterSpacing.sectionLabel),
    );
    expect(el.style.color).toBe(normalizedStyleValue('color', text.secondaryDim));
  });
});

describe('HexBadge', () => {
  it('renders the label as real text (not aria-hidden)', () => {
    render(<HexBadge label="AI" />);
    const el = screen.getByText('AI');

    expect(el.closest('[aria-hidden]')).toBeNull();
  });

  it('applies the hexagon clipPath', () => {
    const { container } = render(<HexBadge label="AI" />);
    const clipped = Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
      (el) => el.style.clipPath.length > 0,
    );
    expect(clipped.length).toBeGreaterThan(0);
    for (const el of clipped) {
      expect(el.style.clipPath).toBe(
        'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
      );
    }
  });

  it('defaults accentColor to accent.jarvisBlue', () => {
    const { container } = render(<HexBadge label="AI" />);
    const accentLayer = Array.from(container.querySelectorAll<HTMLElement>('div')).find(
      (el) => el.style.backgroundColor.length > 0,
    );
    expect(accentLayer?.style.backgroundColor).toBe(
      normalizedStyleValue('background-color', accent.jarvisBlue),
    );
  });

  it('respects an accentColor override', () => {
    const { container } = render(<HexBadge label="AI" accentColor={accent.warning} />);
    const accentLayer = Array.from(container.querySelectorAll<HTMLElement>('div')).find(
      (el) => el.style.backgroundColor.length > 0,
    );
    expect(accentLayer?.style.backgroundColor).toBe(
      normalizedStyleValue('background-color', accent.warning),
    );
  });
});
