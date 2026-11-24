import { GROUP_SIZE } from '@secret-santa/shared';

/** Placeholder home page; the real screens arrive in milestones M5 to M7. */
export function App() {
  return (
    <main>
      <h1>Secret Santa</h1>
      <p>
        Groups of {GROUP_SIZE.min} to {GROUP_SIZE.max} friends. Coming soon.
      </p>
    </main>
  );
}
