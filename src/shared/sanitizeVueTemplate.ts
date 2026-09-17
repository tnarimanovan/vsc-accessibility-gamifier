function removePreservingLines(match: string): string {
  return match.replace(/[^\n]/g, ' ');
}

function replaceInterpolationPreservingLines(match: string): string {
  const newlineCount = (match.match(/\n/g) || []).length;
  return `TEXT${'\n'.repeat(newlineCount)}`;
}

export function sanitizeVueTemplate(template: string): string {
  return (
    template
      // Vue interpolation
      .replace(/\{\{[\s\S]*?\}\}/g, replaceInterpolationPreservingLines)

      // Dynamic bindings (:prop="")
      .replace(/:\w+(?:-[\w]+)?="[^"]*"/g, removePreservingLines)

      // Event handlers (@click, @keydown, ...)
      .replace(/@\w+(?:\.[\w-]+)*(?:="[^"]*")?/g, removePreservingLines)

      // v-bind
      .replace(/v-bind:\w+(?:-[\w]+)?="[^"]*"/g, removePreservingLines)

      // v-on
      .replace(/v-on:\w+(?:-[\w]+)?="[^"]*"/g, removePreservingLines)

      // Common directives
      .replace(/\sv-if="[^"]*"/g, removePreservingLines)
      .replace(/\sv-else-if="[^"]*"/g, removePreservingLines)
      .replace(/\sv-else\b/g, removePreservingLines)
      .replace(/\sv-show="[^"]*"/g, removePreservingLines)
      .replace(/\sv-for="[^"]*"/g, removePreservingLines)
      .replace(/\sv-model(?::[\w-]+)?="[^"]*"/g, removePreservingLines)
      .replace(/\sv-slot(?::[\w-]+)?="[^"]*"/g, removePreservingLines)
      .replace(/\sv-text="[^"]*"/g, removePreservingLines)
      .replace(/\sv-html="[^"]*"/g, removePreservingLines)

      // Vue keys / refs
      .replace(/\s:key="[^"]*"/g, removePreservingLines)
      .replace(/\sref="[^"]*"/g, removePreservingLines)
  );
}
