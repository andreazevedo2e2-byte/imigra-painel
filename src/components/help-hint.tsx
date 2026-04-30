type HelpHintProps = {
  label: string;
  className?: string;
};

export function HelpHint({ label, className }: HelpHintProps) {
  return (
    <span
      className={className}
      title={label}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        marginLeft: 8,
        borderRadius: 999,
        border: '1px solid rgba(148,163,184,0.28)',
        color: 'rgba(191, 203, 220, 0.95)',
        fontSize: 11,
        fontWeight: 800,
        cursor: 'help',
        background: 'rgba(15, 23, 42, 0.7)',
      }}
    >
      ?
    </span>
  );
}
