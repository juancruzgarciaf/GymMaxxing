import { useEffect, useState } from "react";

type DurationInputProps = {
  seconds: number;
  onChangeSeconds: (seconds: number) => void;
  className?: string;
  ariaLabel?: string;
};

const twoDigits = (value: number) => String(value).padStart(2, "0");

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const min = Math.floor(safeSeconds / 60);
  const sec = safeSeconds % 60;
  return `${twoDigits(min)}:${twoDigits(sec)}`;
};

const parseDurationInput = (value: string) => {
  const cleanValue = value.trim();
  if (!cleanValue) {
    return 0;
  }

  if (cleanValue.includes(":")) {
    const [minRaw = "0", secRaw = "0"] = cleanValue.split(":");
    const min = Number(minRaw || "0");
    const sec = Number(secRaw || "0");
    return (Number.isNaN(min) ? 0 : Math.max(0, Math.floor(min))) * 60 +
      (Number.isNaN(sec) ? 0 : Math.max(0, Math.floor(sec)));
  }

  const digits = cleanValue.replace(/\D/g, "");
  if (!digits) {
    return 0;
  }

  if (digits.length <= 2) {
    return Number(digits);
  }

  const seconds = Number(digits.slice(-2));
  const minutes = Number(digits.slice(0, -2));
  return (Number.isNaN(minutes) ? 0 : minutes) * 60 + (Number.isNaN(seconds) ? 0 : seconds);
};

export default function DurationInput({
  seconds,
  onChangeSeconds,
  className,
  ariaLabel,
}: DurationInputProps) {
  const [draft, setDraft] = useState(() => formatDuration(seconds));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(formatDuration(seconds));
    }
  }, [isFocused, seconds]);

  const commitDraft = (value: string) => {
    const nextSeconds = parseDurationInput(value);
    onChangeSeconds(nextSeconds);
    return nextSeconds;
  };

  return (
    <input
      className={className}
      type="text"
      inputMode="numeric"
      pattern="[0-9:]*"
      placeholder="00:00"
      value={draft}
      onFocus={(event) => {
        setIsFocused(true);
        setDraft(formatDuration(seconds));
        event.currentTarget.select();
      }}
      onChange={(event) => {
        setDraft(event.target.value);
        commitDraft(event.target.value);
      }}
      onBlur={() => {
        setIsFocused(false);
        setDraft(formatDuration(commitDraft(draft)));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.currentTarget.blur();
        }
      }}
      aria-label={ariaLabel}
    />
  );
}
