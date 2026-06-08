import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: (Option | string)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Pilih opsi...",
  required = false,
  disabled = false,
  style = {}
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Normalize options to { value, label } structure
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "string") {
      return { value: opt, label: opt };
    }
    return opt;
  });

  // Filter options based on search query
  const filteredOptions = normalizedOptions.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  // Find currently selected option label
  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Reset search query when dropdown opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        position: "relative", 
        width: "100%",
        fontFamily: "inherit",
        ...style 
      }}
    >
      {/* Hidden input to support native form required validations */}
      <input
        type="text"
        value={value}
        onChange={() => {}}
        required={required}
        tabIndex={-1}
        style={{
          opacity: 0,
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none"
        }}
      />

      {/* Select Box Header */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          padding: "10px 14px",
          fontSize: "var(--text-sm)",
          border: isOpen ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          background: disabled ? "var(--color-muted)" : "var(--color-surface)",
          color: selectedOption ? "var(--color-text)" : "var(--color-text-muted)",
          cursor: disabled ? "not-allowed" : "pointer",
          minHeight: "44px",
          userSelect: "none",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: isOpen ? "0 0 0 3px rgba(31, 107, 60, 0.1)" : "none"
        }}
      >
        <span style={{ 
          whiteSpace: "nowrap", 
          overflow: "hidden", 
          textOverflow: "ellipsis", 
          maxWidth: "90%" 
        }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown 
          size={16} 
          style={{ 
            color: "var(--color-text-muted)", 
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", 
            transition: "transform 0.2s ease",
            flexShrink: 0
          }} 
        />
      </div>

      {/* Dropdown Overlay */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 1000,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            maxHeight: "300px",
            animation: "fadeIn 0.15s ease forwards"
          }}
        >
          {/* Search Box */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 12px",
              borderBottom: "1px solid var(--color-border)",
              background: "var(--color-muted)"
            }}
          >
            <Search size={14} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Cari..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "var(--text-sm)",
                color: "var(--color-text)",
                padding: "2px 0"
              }}
              autoFocus
            />
          </div>

          {/* Options List */}
          <div
            style={{
              overflowY: "auto",
              flex: 1
            }}
          >
            {filteredOptions.length === 0 ? (
              <div
                style={{
                  padding: "12px 16px",
                  fontSize: "var(--text-xs)",
                  color: "var(--color-text-muted)",
                  textAlign: "center"
                }}
              >
                Tidak ada hasil ditemukan
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    style={{
                      padding: "10px 16px",
                      fontSize: "var(--text-sm)",
                      color: isSelected ? "var(--color-primary-dark)" : "var(--color-text)",
                      background: isSelected ? "var(--color-primary-bg)" : "transparent",
                      cursor: "pointer",
                      fontWeight: isSelected ? 600 : 400,
                      transition: "background 0.15s",
                      userSelect: "none"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "var(--color-muted)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    {opt.label}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
