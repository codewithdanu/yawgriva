import React from "react";
import { Loader2 } from "lucide-react";

export interface MapData {
  origin_name: string;
  origin_lat: number;
  origin_lng: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
  distance_km?: number;
  duration_min?: number;
  route_summary?: string;
}

interface MarkdownRendererProps {
  content: string;
  renderMap?: (mapData: MapData) => React.ReactNode;
}

export function parseInlineMarkdown(text: string): React.ReactNode {
  const regex = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;
  const parts = text.split(regex);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} style={{ fontWeight: 600, color: "var(--color-text)" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} style={{ fontStyle: "italic" }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          style={{
            background: "var(--color-muted)",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "var(--color-primary)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function MarkdownRenderer({ content, renderMap }: MarkdownRendererProps) {
  if (!content) return null;

  // Normalize separators safely
  const normalizedText = content
    .replace(/(?<=^|\n)\s*---\s*(?=\n|$)/g, "\n---\n")
    .replace(/(?<=^|[^\n])\s*###/g, "\n###")
    .replace(/\n+/g, "\n");

  const lines = normalizedText.split("\n");
  const jsxElements: React.ReactNode[] = [];
  
  let bulletItems: string[] = [];
  let numberedItems: string[] = [];
  let tableRows: string[][] = [];

  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let codeBlockLang = "";

  const flushBulletList = () => {
    if (bulletItems.length > 0) {
      const items = [...bulletItems];
      bulletItems.length = 0;
      jsxElements.push(
        <ul key={`list-${jsxElements.length}`} className="md-ul" style={{ listStyleType: "disc", paddingLeft: "var(--space-5)", margin: "var(--space-2) 0", display: "flex", flexDirection: "column", gap: "6px" }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", lineHeight: 1.5 }}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
    }
  };

  const flushNumberedList = () => {
    if (numberedItems.length > 0) {
      const items = [...numberedItems];
      numberedItems.length = 0;
      jsxElements.push(
        <ol key={`ol-${jsxElements.length}`} className="md-ol" style={{ listStyleType: "decimal", paddingLeft: "var(--space-5)", margin: "var(--space-2) 0", display: "flex", flexDirection: "column", gap: "6px" }}>
          {items.map((item, idx) => (
            <li key={idx} style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", lineHeight: 1.5 }}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ol>
      );
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const rows = [...tableRows];
      tableRows.length = 0;
      
      const headers = rows[0];
      const dataRows = rows.slice(1);

      jsxElements.push(
        <div key={`table-wrapper-${jsxElements.length}`} style={{ overflowX: "auto", margin: "var(--space-4) 0", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", width: "100%", WebkitOverflowScrolling: "touch" }}>
          <table className="md-table" style={{ width: "100%", minWidth: "500px", borderCollapse: "collapse", textAlign: "left", fontSize: "var(--text-xs)" }}>
            <thead>
              <tr style={{ background: "var(--color-primary-bg)", borderBottom: "1px solid var(--color-border)" }}>
                {headers.map((h, idx) => (
                  <th key={idx} style={{ padding: "8px 12px", fontWeight: 600, color: "var(--color-primary-dark)" }}>
                    {parseInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataRows.map((row, rIdx) => (
                <tr key={rIdx} style={{ borderBottom: rIdx < dataRows.length - 1 ? "1px solid var(--color-border)" : "none", background: rIdx % 2 === 0 ? "white" : "var(--color-muted)" }}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: "8px 12px", color: "var(--color-text)" }}>
                      {parseInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  };

  const flushAll = () => {
    flushBulletList();
    flushNumberedList();
    flushTable();
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Check code block bounds
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        inCodeBlock = false;
        const codeContent = codeBlockLines.join("\n");
        const key = `code-${jsxElements.length}`;

        if (codeBlockLang === "map" && renderMap) {
          try {
            const mapData = JSON.parse(codeContent);
            jsxElements.push(renderMap(mapData));
          } catch (e) {
            // Render loading block while JSON is still streaming or has syntax errors
            jsxElements.push(
              <div key={key} style={{ margin: "12px 0", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--color-muted)", maxWidth: "500px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Loader2 size={16} className="spin animate-spin" style={{ color: "var(--color-primary)" }} />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>Menyiapkan visualisasi rute peta...</span>
                </div>
              </div>
            );
          }
        } else {
          jsxElements.push(
            <pre key={key} style={{ background: "var(--color-muted)", padding: "10px", borderRadius: "8px", overflowX: "auto", fontSize: "12px", fontFamily: "monospace", margin: "8px 0" }}>
              <code>{codeContent}</code>
            </pre>
          );
        }
        codeBlockLines = [];
        codeBlockLang = "";
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim().toLowerCase();
        flushBulletList();
        flushNumberedList();
        flushTable();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    if (!line) continue;

    // Check if it's a table row: starts with '|' and ends with '|'
    if (line.startsWith("|") && line.endsWith("|")) {
      flushBulletList();
      flushNumberedList();
      
      // Parse columns
      const cols = line.split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      
      // Check if it's a separator line (e.g. |---|---| or | :--- | ---: |)
      const isSeparator = cols.every(c => /^:?-+:?$/.test(c));
      if (isSeparator) {
        continue;
      }
      
      tableRows.push(cols);
      continue;
    }

    // Not a table row, flush accumulated table if any
    flushTable();

    if (line === "---") {
      flushBulletList();
      flushNumberedList();
      jsxElements.push(<hr key={`hr-${jsxElements.length}`} className="md-hr" style={{ border: 0, borderTop: "1px solid var(--color-border)", margin: "var(--space-4) 0" }} />);
      continue;
    }

    // Check for headings: # to ######
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushBulletList();
      flushNumberedList();
      const level = headingMatch[1].length;
      let title = headingMatch[2].trim();
      if (title.startsWith("**") && title.endsWith("**")) {
        title = title.slice(2, -2);
      }
      
      const content = parseInlineMarkdown(title);
      const fontSize = level === 1 ? "var(--text-2xl)" : level === 2 ? "var(--text-xl)" : level === 3 ? "var(--text-lg)" : "var(--text-base)";
      const style = { fontSize, fontWeight: 700, color: "var(--color-primary-dark)", margin: "var(--space-4) 0 var(--space-2)", borderBottom: level <= 3 ? "1px solid rgba(31, 107, 60, 0.15)" : "none", paddingBottom: level <= 3 ? "4px" : 0 };
      const key = `h-${jsxElements.length}`;

      if (level === 1) jsxElements.push(<h1 key={key} style={style}>{content}</h1>);
      else if (level === 2) jsxElements.push(<h2 key={key} style={style}>{content}</h2>);
      else if (level === 3) jsxElements.push(<h3 key={key} style={style}>{content}</h3>);
      else if (level === 4) jsxElements.push(<h4 key={key} style={style}>{content}</h4>);
      else if (level === 5) jsxElements.push(<h5 key={key} style={style}>{content}</h5>);
      else jsxElements.push(<h6 key={key} style={style}>{content}</h6>);
      continue;
    }

    // Check for bullet lists
    if (line.startsWith("*") || line.startsWith("-") || line.startsWith("•")) {
      flushNumberedList();
      const content = line.replace(/^[-*•]\s*/, "").trim();
      bulletItems.push(content);
      continue;
    }

    // Check for numbered lists
    const numberedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      flushBulletList();
      const content = numberedMatch[1].trim();
      numberedItems.push(content);
      continue;
    }

    // Normal paragraph line
    flushBulletList();
    flushNumberedList();
    jsxElements.push(
      <p key={`p-${jsxElements.length}`} className="md-p" style={{ fontSize: "var(--text-sm)", color: "var(--color-text)", lineHeight: 1.6, margin: "var(--space-2) 0" }}>
        {parseInlineMarkdown(line)}
      </p>
    );
  }

  // Flush remaining elements
  flushAll();

  return <div className="markdown-body">{jsxElements}</div>;
}
