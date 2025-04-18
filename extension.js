const vscode = require("vscode");

function simpleFormat(document) {
  const text = document.getText();
  const languageId = document.languageId;

  let formatted = text;

  const editorConfig = vscode.workspace.getConfiguration("editor", document.uri);
  const indentSize = editorConfig.get("tabSize") || 2;
  const insertSpaces = editorConfig.get("insertSpaces") !== false;
  const userIndentation = vscode.workspace.getConfiguration("htmlFormatter").get("indentationLevel", 1);

  const INDENT = (lvl) => {
    const level = Math.max(0, lvl);
    return insertSpaces ? " ".repeat(indentSize * level) : "\t".repeat(level);
  };

  if (["html", "php", "blade"].includes(languageId)) {
    const selfClosingTags = [
      "area", "base", "br", "col", "embed", "hr", "img",
      "input", "link", "meta", "param", "source", "track", "wbr"
    ];
    const voidTagRegex = new RegExp(`^<(${selfClosingTags.join("|")})(\\s|>|/)`, "i");

    const result = [];
    let indent = 0;

    const temp = text
      .replace(/>\s*</g, ">\n<") // Séparation des balises côte à côte
      .replace(/<!--.*?-->/gs, (m) => "\n" + m + "\n")
      .replace(/<!DOCTYPE[^>]*>/gi, (m) => "\n" + m + "\n");

    const allLines = temp.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);

    for (let i = 0; i < allLines.length; i++) {
      let line = allLines[i];

      // Éviter la rupture de balises simples ou PHP
      if (
        line.match(/^<\?php.+\?>$/) || // lignes PHP
        line.match(/^<script.*<\/script>$/) || // scripts inline
        line.match(/^<link[^>]*>$/) || // liens css
        line.match(/^<meta[^>]*>$/) || // meta
        line.match(/^<a\s+[^>]+>.*<\/a>$/) || // liens inline
        line.match(/^<h[1-6]>.*<\/h[1-6]>$/) // titres sur une ligne
      ) {
        result.push(INDENT(indent) + line);
        continue;
      }

      const isClosingTag = /^<\/.+>/.test(line);
      const isSelfClosing = /\/>$/.test(line) || voidTagRegex.test(line);
      const isOpeningTag = /^<[^/!][^>]*[^/]?>$/.test(line) && !line.includes("</");
      const isComment = /^<!--/.test(line) || /^<!DOCTYPE/i.test(line);

      if (isClosingTag && !isSelfClosing && !isComment) {
        indent--;
      }

      result.push(INDENT(indent) + line);

      if (isOpeningTag && !isSelfClosing && !isComment && !isClosingTag) {
        indent += Math.max(1, userIndentation);
      }
    }

    formatted = result.join("\n");
  }

  return formatted;
}

function applyFormat(document) {
  const formattedText = simpleFormat(document);

  const fullRange = new vscode.Range(
    document.positionAt(0),
    document.positionAt(document.getText().length)
  );

  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, fullRange, formattedText);
  return vscode.workspace.applyEdit(edit);
}

function activate(context) {
  const disposable = vscode.commands.registerCommand(
    "htmlFormatter.runFormatter",
    async function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      try {
        await applyFormat(editor.document);
      } catch (err) {
        vscode.window.showErrorMessage("Erreur durant le formatage.");
        console.error("Erreur:", err);
      }
    }
  );

  vscode.workspace.onWillSaveTextDocument((event) => {
    const document = event.document;
    if (!["html", "php", "blade"].includes(document.languageId)) return;
    event.waitUntil(
      (async () => {
        try {
          await applyFormat(document);
        } catch (err) {
          vscode.window.showErrorMessage("Erreur lors du formatage automatique.");
          console.error("Erreur auto-format:", err);
        }
      })()
    );
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
