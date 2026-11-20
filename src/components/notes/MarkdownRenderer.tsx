import { Fragment } from 'react';
import { parseMarkdownAst, type BlockNode, type InlineNode } from '../../domain/notes/markdown';

interface MarkdownRendererProps {
  readonly content: string;
  readonly onToggleChecklistLine?: (lineIndex: number) => void;
}

function renderInline(nodes: readonly InlineNode[], keyPrefix: string) {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case 'text':
        return <Fragment key={key}>{node.text}</Fragment>;
      case 'code':
        return <code key={key}>{node.code}</code>;
      case 'bold':
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case 'italic':
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case 'strike':
        return <del key={key}>{renderInline(node.children, key)}</del>;
      case 'link':
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer">
            {node.label}
          </a>
        );
    }
  });
}

function renderBlock(
  block: BlockNode,
  index: number,
  onToggleChecklistLine?: (lineIndex: number) => void,
) {
  const key = `block-${index}`;
  switch (block.type) {
    case 'heading': {
      const Tag = block.level === 1 ? 'h1' : block.level === 2 ? 'h2' : 'h3';
      return <Tag key={key}>{renderInline(block.children, key)}</Tag>;
    }
    case 'paragraph':
      return <p key={key}>{renderInline(block.children, key)}</p>;
    case 'blockquote':
      return <blockquote key={key}>{renderInline(block.children, key)}</blockquote>;
    case 'code_block':
      return (
        <pre key={key}>
          <code>{block.code}</code>
        </pre>
      );
    case 'hr':
      return <hr key={key} />;
    case 'unordered_list':
      return (
        <ul key={key}>
          {block.items.map((item, idx) => (
            <li key={`${key}-li-${idx}`}>{renderInline(item, `${key}-li-${idx}`)}</li>
          ))}
        </ul>
      );
    case 'ordered_list':
      return (
        <ol key={key}>
          {block.items.map((item, idx) => (
            <li key={`${key}-ol-${idx}`}>{renderInline(item, `${key}-ol-${idx}`)}</li>
          ))}
        </ol>
      );
    case 'checklist':
      return (
        <ul key={key} className="md-checklist">
          {block.items.map((item) => (
            <li key={`${key}-chk-${item.lineIndex}`}>
              <label>
                <input
                  type="checkbox"
                  checked={item.checked}
                  disabled={!onToggleChecklistLine}
                  onChange={() => onToggleChecklistLine?.(item.lineIndex)}
                />
                <span className={item.checked ? 'is-checked' : undefined}>
                  {renderInline(item.children, `${key}-chk-${item.lineIndex}`)}
                </span>
              </label>
            </li>
          ))}
        </ul>
      );
  }
}

export function MarkdownRenderer({ content, onToggleChecklistLine }: MarkdownRendererProps) {
  const blocks = parseMarkdownAst(content);

  if (blocks.length === 0) {
    return (
      <div className="markdown-preview scroller">
        <p className="markdown-empty">
          Nothing to preview yet. Write Markdown on the left to see live formatting and clickable checklists.
        </p>
      </div>
    );
  }

  return (
    <div className="markdown-preview scroller">
      {blocks.map((block, idx) => renderBlock(block, idx, onToggleChecklistLine))}
    </div>
  );
}
