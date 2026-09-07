import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppSkeleton from '@/components/common/placeholder/AppSkeleton.vue';

describe('AppSkeleton', () => {
  it('stands in for a line of writing by default', () => {
    const wrapper = mount(AppSkeleton);

    expect(wrapper.classes()).toContain('app_skeleton_text');
    // Nothing of its own: the shape of a line comes from the stylesheet, and a size given
    // here would win over whatever the caller styles it with.
    expect(wrapper.attributes('style')).toBeUndefined();
    expect(wrapper.attributes('aria-hidden')).toBe('true');
  });

  it('takes the room it is given, in the shape it is asked for', () => {
    const wrapper = mount(AppSkeleton, {
      props: { variant: 'circle', width: '2rem', height: '2rem' },
    });

    expect(wrapper.classes()).toContain('app_skeleton_circle');
    expect(wrapper.attributes('style')).toBe('width: 2rem; height: 2rem;');
  });
});
