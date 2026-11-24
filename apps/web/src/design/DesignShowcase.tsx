import { useState } from 'react';
import { GROUP_SIZE } from '@secret-santa/shared';
import {
  Button,
  Card,
  JoinCounter,
  Ornament,
  ParticipantChip,
  RevealCard,
  TextAreaField,
  TextField,
} from './components';
import styles from './DesignShowcase.module.css';

const total = 5;

/** A living catalogue of the design system's tokens and components. */
export function DesignShowcase() {
  const [joined, setJoined] = useState(3);
  const [names, setNames] = useState('Anna\nMarco\nGiulia');
  const nameCount = names.split('\n').filter((line) => line.trim() !== '').length;
  const everyoneJoined = joined === total;

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.ornaments}>
          <Ornament color="red" size={64} />
          <Ornament shape="candyCane" color="red" size={52} delay={0.6} />
          <Ornament color="green" size={88} delay={1.2} />
          <Ornament shape="gift" color="red" size={64} delay={1.8} />
          <Ornament color="white" size={56} delay={2.4} />
          <Ornament shape="candyCane" color="green" size={48} delay={2.9} />
          <Ornament shape="gift" color="white" size={58} delay={3.4} />
          <Ornament color="red" size={76} delay={3.1} />
        </div>
        <h1 className={styles.title}>Secret Santa</h1>
        <p className={styles.subtitle}>
          Design system preview. Groups of {GROUP_SIZE.min} to {GROUP_SIZE.max} friends.
        </p>
      </header>

      <main className={styles.grid}>
        <Card>
          <h2 className={styles.heading}>Colours</h2>
          <ul className={styles.swatches}>
            {[
              ['Green 700', 'var(--color-green-700)'],
              ['Green 500', 'var(--color-green-500)'],
              ['Green 100', 'var(--color-green-100)'],
              ['Red 700', 'var(--color-red-700)'],
              ['Red 500', 'var(--color-red-500)'],
              ['Red 100', 'var(--color-red-100)'],
              ['Snow', 'var(--color-snow)'],
              ['Gold', 'var(--color-gold)'],
            ].map(([name, value]) => (
              <li key={name} className={styles.swatch}>
                <span className={styles.swatchColor} style={{ background: value }} />
                {name}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className={styles.heading}>Buttons</h2>
          <div className={styles.row}>
            <Button>Create a group</Button>
            <Button variant="accent">Join</Button>
            <Button variant="ghost">Copy link</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>

        <Card>
          <h2 className={styles.heading}>Text field</h2>
          <div className={styles.stack}>
            <TextField label="Group name" placeholder="Family 2026" hint="Up to 60 characters" />
            <TextField label="Join code" defaultValue="ABCD234" error="Codes have 8 characters" />
          </div>
        </Card>

        <Card>
          <h2 className={styles.heading}>Text area</h2>
          <TextAreaField
            label="Names"
            placeholder={'Anna\nMarco\nGiulia'}
            hint={`One name per line \u00b7 ${nameCount} ${nameCount === 1 ? 'name' : 'names'}`}
            error={
              nameCount > 0 && nameCount < GROUP_SIZE.min
                ? `Add at least ${GROUP_SIZE.min} names`
                : undefined
            }
            value={names}
            onChange={(event) => setNames(event.target.value)}
          />
        </Card>

        <Card>
          <h2 className={styles.heading}>Join counter</h2>
          <div className={styles.stack}>
            <JoinCounter joined={joined} total={total} label={`${joined} of ${total} joined`} />
            <div className={styles.row}>
              <Button variant="ghost" onClick={() => setJoined((n) => Math.max(0, n - 1))}>
                One leaves
              </Button>
              <Button variant="ghost" onClick={() => setJoined((n) => Math.min(total, n + 1))}>
                One joins
              </Button>
            </div>
            <div className={styles.row}>
              {['Anna', 'Marco', 'Giulia', 'Luca', 'Sara'].map((name, index) => (
                <ParticipantChip
                  key={name}
                  name={name}
                  state={index === 0 ? 'you' : index < joined ? 'taken' : 'free'}
                  stateLabel={index === 0 ? 'you' : index < joined ? 'joined' : 'not joined yet'}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card variant="snow">
          <h2 className={styles.heading}>Snow card</h2>
          <p className={styles.snowText}>
            You&apos;re invited to the family Secret Santa. Pick your name before the deadline!
          </p>
          <Button variant="ghost" className={styles.onSnow}>
            Join the group
          </Button>
        </Card>

        <Card className={styles.revealCard}>
          <h2 className={styles.heading}>Reveal</h2>
          <RevealCard
            key={String(everyoneJoined)}
            locked={!everyoneJoined}
            recipient={everyoneJoined ? 'Giulia' : undefined}
            lockedText="Waiting for everyone to join"
            promptText="Tap to reveal"
            revealedTitle="You are giving a gift to"
          />
        </Card>
      </main>
    </div>
  );
}
