export const badgeClass = (type: "IN" | "OUT") =>
  type === "IN" ? "bg-in/[.14] text-in" : "bg-out/[.14] text-out";

export function EmployeeAvatar({
  photo,
  sizeClass = "w-8 h-8",
  bordered = false,
}: {
  photo?: string;
  sizeClass?: string;
  bordered?: boolean;
}) {
  const className = `flex-shrink-0 bg-panel-2 rounded-full object-cover ${sizeClass} ${
    bordered ? "border-2 border-line" : ""
  }`;
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={className} src={photo} alt="" />
  ) : (
    <div className={className} />
  );
}

export function FieldLabel({
  children,
  first,
}: {
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <label
      className={`block text-xs tracking-wide text-ink-dim ${
        first ? "mt-0" : "mt-3.5"
      } mb-1.5`}
    >
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="bg-panel-2 px-[13px] py-[11px] border border-line focus:border-scan rounded-[9px] outline-none w-full text-ink text-sm"
    />
  );
}
