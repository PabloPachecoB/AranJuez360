interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  color?: "primary" | "secondary";
  label?: string;
}

const COLOR_CLASES: Record<NonNullable<Props["color"]>, string> = {
  primary: "peer-checked:bg-primary",
  secondary: "peer-checked:bg-secondary",
};

export function Switch({ checked, onChange, color = "secondary", label }: Props) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <div
        className={`w-9 h-5 bg-surface-container-highest rounded-full peer peer-focus:outline-none after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-container-lowest after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full ${COLOR_CLASES[color]}`}
      />
    </label>
  );
}
