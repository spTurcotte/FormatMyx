const vscode = require("vscode");
const parse5 = require("parse5"); // AST parser

// Recursively format AST nodes with proper indentation
function formatAstNodes(nodes, indentLevel, indentStr, result) {
  for (const node of nodes) {
    if (node.nodeName === "#text") {
      const text = node.value.trim();
      if (text) {
        result.push(indentStr.repeat(indentLevel) + text);
      }
    } else if (node.nodeName === "#comment") {
      result.push(
        indentStr.repeat(indentLevel) + `<!-- ${node.data.trim()} -->`
      );
    } else if (node.tagName) {
      const tag = node.tagName;
      // Serialize attributes
      const attrs = node.attrs.map(a => `${a.name}="${a.value}"`).join(" ");
      const openTag = attrs ? `<${tag} ${attrs}>` : `<${tag}>`;

      // Void tags (self‑closing in HTML)
      const voidTags = new Set([
        "area","base","br","col","embed","hr","img",
        "input","link","meta","param","source","track","wbr"
      ]);

      result.push(indentStr.repeat(indentLevel) + openTag);

      // Recurse for children if not a void tag
      if (!voidTags.has(tag)) {
        formatAstNodes(node.childNodes || [], indentLevel + 1, indentStr, result);
        result.push(indentStr.repeat(indentLevel) + `</${tag}>`);
      }
    }
  }
}

// Very simple visual fallback for JS/TS/CSS
function simpleVisualFormat(text) {
  return text
    .replace(/\{\s*/g, "{\n  ")
    .replace(/;\s*/g, ";\n  ")
    .replace(/\}\s*/g, "\n}\n");
}

// Main formatting function
function simpleFormat(document) {
  const text = document.getText();
  const languageId = document.languageId;

  const cfg = vscode.workspace.getConfiguration("formatmyx", document.uri);
  const indentSize = vscode.workspace
    .getConfiguration("editor", document.uri)
    .get("tabSize", 2);
  const insertSpaces = vscode.workspace
    .getConfiguration("editor", document.uri)
    .get("insertSpaces", true);
  const indentStr = insertSpaces ? " ".repeat(indentSize) : "\t";
  const userIndent = cfg.get("indentationLevel", 1);
  const useAST = cfg.get("enableAST", false);

  // HTML/PHP/Blade: AST formatting if enabled
  if (["html","php","blade"].includes(languageId) && useAST) {
    const ast = parse5.parse(text);
    const result = [];
    formatAstNodes(ast.childNodes, 0, indentStr, result);
    return result.join("\n");
  }

  // JS/TS/CSS: simple visual formatting
  if (["javascript","typescript","css"].includes(languageId)) {
    return simpleVisualFormat(text);
  }

  // Fallback: no change
  return text;
}

// Apply edits to the document
async function applyFormat(document) {
  const formatted = simpleFormat(document);
  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullRange, formatted);
  await vscode.workspace.applyEdit(edit);
}

// Activate extension
function activate(context) {
  console.log("FormatMyx v2 activated");

  // Manual command
  context.subscriptions.push(
    vscode.commands.registerCommand("formatMyx.runFormatter", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await applyFormat(editor.document);
      }
    })
  );

  // Format on save
  context.subscriptions.push(
    vscode.workspace.onWillSaveTextDocument(event => {
      const doc = event.document;
      if (
        ["html","php","blade","javascript","typescript","css"].includes(
          doc.languageId
        )
      ) {
        event.waitUntil(applyFormat(doc));
      }
    })
  );
}

// Deactivate extension
function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
