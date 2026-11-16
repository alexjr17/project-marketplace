import { describe, expect, it } from 'vitest';
import { newScene, TRANSITION_SOUND_DEFAULT, TRANSITIONS } from './timeline';
import { SOUNDS, sfxCues, TRANSITION_SOUNDS } from './sfx';

describe('sonidos de las transiciones', () => {
  it('cada transición tiene varios sonidos y el recomendado es el de las escenas nuevas', () => {
    for (const t of TRANSITIONS) {
      expect(TRANSITION_SOUNDS[t.value].length, t.value).toBeGreaterThan(1);
      expect(TRANSITION_SOUNDS[t.value][0]).toBe(TRANSITION_SOUND_DEFAULT[t.value]);
      TRANSITION_SOUNDS[t.value].forEach((id) => expect(SOUNDS.some((s) => s.value === id)).toBe(true));
      expect(newScene({ transition: t.value }).sound).toBe(TRANSITION_SOUND_DEFAULT[t.value]);
    }
  });

  it('el golpe del sonido cae en el corte; sin sonido o sin siguiente no suena', () => {
    const s = [newScene({ seconds: 4, transition: 'zoom', sound: 'riser' }), newScene({ seconds: 3, sound: null }), newScene({ seconds: 3, transition: 'corte' })];
    expect(sfxCues(s, false)).toEqual([{ sound: 'riser', at: 4 - 0.95 }]);
    const withEnd = sfxCues(s, true);
    expect(withEnd).toHaveLength(2);
    expect(withEnd[1]).toEqual({ sound: 'click', at: 10 });
  });
});
