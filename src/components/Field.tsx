import type { ReactElement, ReactNode } from 'react';

export interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}

export default function Field({ label, htmlFor, error, children }: FieldProps): ReactElement {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-text-secondary">
        {label}
      </label>
      {children}
      {error !== undefined && (
        <p role="alert" className="mt-1 text-xs text-margin-bad">
          {error}
        </p>
      )}
    </div>
  );
}
