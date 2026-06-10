'use client';

import React, { useCallback, useEffect } from 'react';
import { Delete, Eraser, LockKeyhole } from 'lucide-react';
import {
  FocusContext,
  setFocus,
  useFocusable,
} from '@noriginmedia/norigin-spatial-navigation';
import styles from './ParentalPinModal.module.css';

type ParentalPinModalProps = {
  title: string;
  description: string;
  pin: string;
  error?: string;
  cancelLabel: string;
  confirmLabel: string;
  clearLabel: string;
  backspaceLabel: string;
  onPinChange: (pin: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

type PinButtonProps = {
  focusKey: string;
  label: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  onPress: () => void;
};

const PIN_LENGTH = 4;
const PIN_DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function PinButton({
  focusKey,
  label,
  ariaLabel,
  className = '',
  onPress,
}: PinButtonProps) {
  const { ref, focused } = useFocusable({
    focusKey,
    onEnterPress: onPress,
  });

  return (
    <button
      ref={ref}
      type="button"
      className={`${styles.keyButton} ${className} ${focused ? styles.focused : ''}`}
      aria-label={ariaLabel ?? (typeof label === 'string' ? label : undefined)}
      onClick={onPress}
    >
      {label}
    </button>
  );
}

export default function ParentalPinModal({
  title,
  description,
  pin,
  error,
  cancelLabel,
  confirmLabel,
  clearLabel,
  backspaceLabel,
  onPinChange,
  onCancel,
  onConfirm,
}: ParentalPinModalProps) {
  const { ref, focusKey } = useFocusable({
    focusKey: 'parental-pin-modal',
    trackChildren: true,
    isFocusBoundary: true,
    focusBoundaryDirections: ['up', 'down', 'left', 'right'],
  });

  const appendDigit = useCallback((digit: string) => {
    if (pin.length >= PIN_LENGTH) return;
    onPinChange(`${pin}${digit}`);
  }, [onPinChange, pin]);

  const removeLastDigit = useCallback(() => {
    onPinChange(pin.slice(0, -1));
  }, [onPinChange, pin]);

  const clearPin = useCallback(() => {
    onPinChange('');
  }, [onPinChange]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setFocus('parental-pin-key-1');
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        appendDigit(event.key);
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        removeLastDigit();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [appendDigit, onCancel, removeLastDigit]);

  return (
    <FocusContext.Provider value={focusKey}>
      <div className={styles.overlay} role="presentation">
        <section
          ref={ref}
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="parental-pin-modal-title"
        >
          <div className={styles.icon}>
            <LockKeyhole size={30} />
          </div>
          <h2 id="parental-pin-modal-title">{title}</h2>
          <p>{description}</p>

          <div className={styles.pinDisplay} aria-label={`${pin.length} / ${PIN_LENGTH}`}>
            {Array.from({ length: PIN_LENGTH }, (_, index) => (
              <span
                key={index}
                className={`${styles.pinDot} ${index < pin.length ? styles.pinDotFilled : ''}`}
              />
            ))}
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.keypad}>
            {PIN_DIGITS.map((digit) => (
              <PinButton
                key={digit}
                focusKey={`parental-pin-key-${digit}`}
                label={digit}
                onPress={() => appendDigit(digit)}
              />
            ))}
            <PinButton
              focusKey="parental-pin-backspace"
              label={<Delete size={24} />}
              ariaLabel={backspaceLabel}
              onPress={removeLastDigit}
              className={styles.iconButton}
            />
            <PinButton
              focusKey="parental-pin-key-0"
              label="0"
              onPress={() => appendDigit('0')}
            />
            <PinButton
              focusKey="parental-pin-clear"
              label={<Eraser size={24} />}
              ariaLabel={clearLabel}
              onPress={clearPin}
              className={styles.iconButton}
            />
          </div>

          <div className={styles.actions}>
            <PinButton
              focusKey="parental-pin-cancel"
              label={cancelLabel}
              onPress={onCancel}
              className={styles.actionButton}
            />
            <PinButton
              focusKey="parental-pin-confirm"
              label={confirmLabel}
              onPress={onConfirm}
              className={styles.actionButton}
            />
          </div>
        </section>
      </div>
    </FocusContext.Provider>
  );
}
