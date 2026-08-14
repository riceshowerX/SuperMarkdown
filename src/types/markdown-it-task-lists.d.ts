declare module 'markdown-it-task-lists' {
  import type MarkdownIt from 'markdown-it';
  interface TaskListOptions {
    /** 是否启用（默认 true） */
    enabled?: boolean;
    /** 是否渲染 checkbox 标签（默认 true） */
    label?: boolean;
    /** 标签位置（默认 false = 前置） */
    labelAfter?: boolean;
  }
  const taskLists: (md: MarkdownIt, options?: TaskListOptions) => void;
  export default taskLists;
}
