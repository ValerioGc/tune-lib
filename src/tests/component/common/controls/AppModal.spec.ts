import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import AppModal from '@/components/common/controls/AppModal.vue';

const props = { open: true, title: 'Rimuovere il track?' };

describe('AppModal', () => {
  it('renders nothing when closed', () => {
    const wrapper = mount(AppModal, { props: { ...props, open: false } });

    expect(wrapper.find('dialog').exists()).toBe(false);
  });

  it('renders title, content, and actions', () => {
    const wrapper = mount(AppModal, {
      props,
      slots: { default: 'Sei sicuro?', actions: '<button>Conferma</button>' },
    });

    expect(wrapper.get('.app_modal_title').text()).toBe('Rimuovere il track?');
    expect(wrapper.get('.app_modal_body').text()).toBe('Sei sicuro?');
    expect(wrapper.get('.app_modal_actions button').text()).toBe('Conferma');
  });

  it('declares the dialog to screen readers', () => {
    const wrapper = mount(AppModal, { props });
    const dialog = wrapper.get('dialog');

    expect(dialog.attributes('aria-modal')).toBe('true');
    expect(dialog.attributes('aria-labelledby')).toBe(
      wrapper.get('.app_modal_title').attributes('id'),
    );
  });

  it('requests close when clicking the backdrop', async () => {
    const wrapper = mount(AppModal, { props });

    await wrapper.get('.app_modal').trigger('click');

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('requests close with Escape', async () => {
    const wrapper = mount(AppModal, { props, attachTo: document.body });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('ignores other keys', async () => {
    const wrapper = mount(AppModal, { props, attachTo: document.body });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('close')).toBeUndefined();
  });

  it('takes the glass and the background of the window when asked', () => {
    const plain = mount(AppModal, { props });
    const glass = mount(AppModal, { props: { ...props, glass: true } });

    expect(plain.get('.app_modal_panel').classes()).not.toContain('app_modal_panel_glass');
    // The gradient itself is drawn by the stylesheet, which reads the two settings from
    // the attributes of the document.
    expect(glass.get('.app_modal_panel').classes()).toContain('app_modal_panel_glass');
  });

  it('gives up its own scrolling box when the content scrolls itself', () => {
    const plain = mount(AppModal, {
      props: { open: true, title: 'Plain' },
      attachTo: document.body,
    });
    const inner = mount(AppModal, {
      props: { open: true, title: 'Inner', contentScrolls: true },
      attachTo: document.body,
    });

    expect(plain.get('.app_modal_body').classes('app_modal_body_content_scrolls')).toBe(false);
    expect(inner.get('.app_modal_body').classes('app_modal_body_content_scrolls')).toBe(true);

    plain.unmount();
    inner.unmount();
  });
});
