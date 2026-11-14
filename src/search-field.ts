export function searchField(input: HTMLInputElement) {
  const wrap = input.ownerDocument.createElement("div");
  wrap.className = "bt-search-field";
  input.before(wrap);
  wrap.appendChild(input);
  input.classList.add("prompt-input");
  input.type="text";input.setAttribute("role","searchbox");
  const clear = input.ownerDocument.createElement("button");
  clear.className = "bt-search-clear";
  clear.setAttribute("aria-label", "Очистить поиск");
  clear.textContent = "×";
  wrap.appendChild(clear);
  clear.onclick = () => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  };
}
