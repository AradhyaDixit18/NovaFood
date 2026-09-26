import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FoodArt } from '../components/food/FoodArt';
import { Nova } from '../components/mascot/Nova';
import { canRender3D } from '../lib/device';
import { QuantityStepper } from '../ui/controls';
import { Rating, VegMark } from '../ui/primitives';

describe('design system', () => {
  it('stepper announces and changes quantity within bounds', async () => {
    const onChange = vi.fn();
    render(<QuantityStepper value={1} min={1} max={2} onChange={onChange} label="Dosa" />);
    expect(screen.getByRole('button', { name: 'Remove one Dosa' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Add one more Dosa' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('marks veg and non-veg accessibly', () => {
    render(<><VegMark veg /><VegMark veg={false} /></>);
    expect(screen.getByRole('img', { name: 'Vegetarian' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Non-vegetarian' })).toBeInTheDocument();
  });

  it('shows "New" instead of a zero rating', () => {
    const { rerender } = render(<Rating value={0} count={0} />);
    expect(screen.getByText(/New/)).toBeInTheDocument();
    rerender(<Rating value={4.26} count={12} />);
    expect(screen.getByText('rated 4.3 out of 5 from 12 reviews')).toBeInTheDocument();
  });

  it('falls back to a default illustration for unknown art', () => {
    const { container } = render(<FoodArt art={{ kind: 'mystery-dish', hue: 10 }} alt="Mystery" />);
    expect(screen.getByRole('img', { name: 'Mystery' })).toBeInTheDocument();
    expect(container.querySelector('svg path')).not.toBeNull();
  });

  it('prefers a real photo when one exists', () => {
    render(<FoodArt art={{ kind: 'pizza', hue: 10 }} imageUrl="https://res.cloudinary.com/demo/image/upload/v1/pizza.jpg" alt="Pizza" width={200} />);
    expect(screen.getByRole('img', { name: 'Pizza' })).toHaveAttribute('src', 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_200/v1/pizza.jpg');
  });
});

describe('mascot & 3D gating', () => {
  it('describes its mood for screen readers', () => {
    render(<Nova mood="celebrate" track={false} />);
    expect(screen.getByRole('img', { name: /feeling celebrate/ })).toBeInTheDocument();
  });

  it('never renders 3D for reduced-motion users', () => {
    (window as unknown as { __reduced?: boolean }).__reduced = true;
    expect(canRender3D()).toBe(false);
    (window as unknown as { __reduced?: boolean }).__reduced = false;
  });
});
