/** Render the shared TurboWarp-Plus-Editor button without replacing the native site header. */
export function renderEditorButton(projectUrl: string): string {
  const editor = new URL(
    "https://kubohiroya.github.io/turbowarp-plus-editor/editor.html",
  );
  editor.searchParams.set("lang", "ja");
  editor.searchParams.set("project_url", projectUrl);
  return `<a class="twpe-edit-button" href="${editor.href.replaceAll("&", "&amp;")}" target="_blank" rel="noopener noreferrer"><img src="https://kubohiroya.github.io/turbowarp-plus-editor/assets/icon.svg" width="32" height="32" alt="" aria-hidden="true">TurboWarp-Plus-Editorで編集</a>`;
}
