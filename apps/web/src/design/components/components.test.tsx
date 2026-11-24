import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Button,
  Card,
  JoinCounter,
  Ornament,
  ParticipantChip,
  RevealCard,
  TextAreaField,
  TextField,
} from '.';

afterEach(cleanup);

describe('Button', () => {
  it('is a non-submitting button that fires onClick', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Join</Button>);
    const button = screen.getByRole('button', { name: 'Join' });
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not fire when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Join
      </Button>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Join' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TextField', () => {
  it('links the label, hint and error to the input', () => {
    render(<TextField label="Group name" hint="Up to 60 characters" error="Required" />);
    const input = screen.getByLabelText('Group name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const texts = describedBy.split(' ').map((id) => document.getElementById(id)?.textContent);
    expect(texts).toEqual(['Up to 60 characters', 'Required']);
  });
});

describe('JoinCounter', () => {
  it('exposes progress to assistive technology', () => {
    render(<JoinCounter joined={3} total={5} label="3 of 5 joined" />);
    const bar = screen.getByRole('progressbar', { name: '3 of 5 joined' });
    expect(bar.getAttribute('aria-valuenow')).toBe('3');
    expect(bar.getAttribute('aria-valuemax')).toBe('5');
  });

  it('clamps values outside the range', () => {
    render(<JoinCounter joined={9} total={5} label="All joined" />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('5');
  });
});

describe('ParticipantChip', () => {
  it('shows the name and a screen-reader state', () => {
    render(<ParticipantChip name="Anna" state="taken" stateLabel="joined" />);
    expect(screen.getByText('Anna').textContent).toBe('Anna, joined');
  });
});

describe('RevealCard', () => {
  const texts = {
    lockedText: 'Waiting for everyone',
    promptText: 'Tap to reveal',
    revealedTitle: 'You are giving a gift to',
  };

  it('stays locked and never shows a recipient while locked', () => {
    render(<RevealCard locked recipient="Giulia" {...texts} />);
    const card = screen.getByRole('button');
    expect(card).toHaveProperty('disabled', true);
    fireEvent.click(card);
    expect(screen.queryByText('Giulia')).toBeNull();
    expect(screen.getByText('Waiting for everyone')).toBeDefined();
  });

  it('shows a locked card, not the gift box, while locked', () => {
    render(<RevealCard locked recipient="Giulia" {...texts} />);
    expect(screen.getByRole('button').getAttribute('data-state')).toBe('locked');
  });

  it('shows a wrapped gift box once unlocked, without the recipient', () => {
    render(<RevealCard locked={false} recipient="Giulia" {...texts} />);
    const gift = screen.getByRole('button', { name: /Tap to reveal/ });
    expect(gift.getAttribute('data-state')).toBe('wrapped');
    expect(gift).toHaveProperty('disabled', false);
    expect(screen.queryByText('Giulia')).toBeNull();
  });

  it('opens the gift box on click and reveals the recipient', () => {
    render(<RevealCard locked={false} recipient="Giulia" {...texts} />);
    const gift = screen.getByRole('button', { name: /Tap to reveal/ });
    fireEvent.click(gift);
    expect(gift.getAttribute('data-state')).toBe('opened');
    expect(screen.getByText('Giulia')).toBeDefined();
    expect(screen.getByText('You are giving a gift to')).toBeDefined();
  });
});

describe('Ornament', () => {
  it('is decorative and hidden from assistive technology', () => {
    const { container } = render(<Ornament color="green" size={40} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(root?.getAttribute('data-color')).toBe('green');
  });

  it('gives each instance its own SVG ids', () => {
    const { container } = render(
      <>
        <Ornament />
        <Ornament />
      </>,
    );
    const ids = Array.from(container.querySelectorAll('clipPath')).map((el) => el.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('Card', () => {
  it('renders the snow variant with its content', () => {
    render(<Card variant="snow">Hello</Card>);
    expect(screen.getByText('Hello').closest('[data-variant]')?.getAttribute('data-variant')).toBe(
      'snow',
    );
  });
});

describe('Ornament shapes', () => {
  it.each(['bauble', 'gift', 'candyCane'] as const)('renders a %s', (shape) => {
    const { container } = render(<Ornament shape={shape} />);
    const root = container.firstElementChild;
    expect(root?.getAttribute('data-shape')).toBe(shape);
    expect(root?.querySelector('svg')).not.toBeNull();
  });
});

describe('TextAreaField', () => {
  it('is a labelled multi-line field with hint and error', () => {
    render(<TextAreaField label="Names" hint="One name per line" error="Add at least 3 names" />);
    const area = screen.getByLabelText('Names');
    expect(area.tagName).toBe('TEXTAREA');
    expect(area.getAttribute('aria-invalid')).toBe('true');
    expect(area.getAttribute('rows')).toBe('6');
  });

  it('reports typed text', () => {
    const onChange = vi.fn();
    render(<TextAreaField label="Names" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Names'), { target: { value: 'Anna\nMarco' } });
    expect(onChange).toHaveBeenCalledOnce();
  });
});
