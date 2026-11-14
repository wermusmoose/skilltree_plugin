/** Keep the full text during motion; restore ellipsis only after closing. */
export function animateTitle(node: HTMLElement, title: HTMLElement) {
  let expanded = false;
  const resize = (open: boolean) => {
    expanded = open;
    if (!title.isConnected) return;
    const style = getComputedStyle(title);
    const border =
      parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const collapsed =
      parseFloat(style.lineHeight) * 2 +
      parseFloat(style.paddingTop) +
      parseFloat(style.paddingBottom) +
      border;
    const current = title.offsetHeight;
    title.style.maxHeight = current + "px";
    title.classList.add("bt-title-moving");
    const full = title.scrollHeight + border;
    void title.offsetHeight;
    title.style.maxHeight = (open ? full : Math.min(collapsed, full)) + "px";
    if (
      title.ownerDocument.defaultView?.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches ||
      Math.abs(current - (open ? full : Math.min(collapsed, full))) < 1
    )
      finish();
  };
  const finish = () => {
    if (!expanded) {
      title.classList.remove("bt-title-moving");
      title.style.removeProperty("max-height");
    }
  };
  node.addEventListener("pointerenter", () => resize(true));
  node.addEventListener("pointerleave", () => resize(false));
  title.addEventListener("transitionend", (event) => {
    if (event.propertyName === "max-height") finish();
  });
}
