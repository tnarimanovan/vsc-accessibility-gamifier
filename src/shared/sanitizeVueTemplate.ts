export function sanitizeVueTemplate(template: string): string {
  return (
    template
      // Vue interpolation
      .replace(/\{\{[\s\S]*?\}\}/g, 'TEXT')

      // Dynamic bindings (:prop="")
      .replace(/:\w+(?:-[\w]+)?="[^"]*"/g, '')

      // Event handlers (@click, @keydown, ...)
      .replace(/@\w+(?:\.[\w-]+)*(?:="[^"]*")?/g, '')

      // v-bind
      .replace(/v-bind:\w+(?:-[\w]+)?="[^"]*"/g, '')

      // v-on
      .replace(/v-on:\w+(?:-[\w]+)?="[^"]*"/g, '')

      // Common directives
      .replace(/\sv-if="[^"]*"/g, '')
      .replace(/\sv-else-if="[^"]*"/g, '')
      .replace(/\sv-else\b/g, '')
      .replace(/\sv-show="[^"]*"/g, '')
      .replace(/\sv-for="[^"]*"/g, '')
      .replace(/\sv-model(?::[\w-]+)?="[^"]*"/g, '')
      .replace(/\sv-slot(?::[\w-]+)?="[^"]*"/g, '')
      .replace(/\sv-text="[^"]*"/g, '')
      .replace(/\sv-html="[^"]*"/g, '')

      // Vue keys / refs
      .replace(/\s:key="[^"]*"/g, '')
      .replace(/\sref="[^"]*"/g, '')

      // Collapse excessive whitespace
      .replace(/\n\s*\n/g, '\n')
  );
}
