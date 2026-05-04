declare module 'dom-to-image-more' {
  interface Options {
    width?: number
    height?: number
    style?: Partial<CSSStyleDeclaration>
    quality?: number
    bgcolor?: string
    imagePlaceholder?: string
    cacheBust?: boolean
    useCORS?: boolean
    allowTaint?: boolean
    foreignObjectRendering?: boolean
    filter?: (node: Node) => boolean
  }
  function toBlob(node: Node, options?: Options): Promise<Blob>
  function toPng(node: Node, options?: Options): Promise<string>
  function toJpeg(node: Node, options?: Options): Promise<string>
  function toSvg(node: Node, options?: Options): Promise<string>
  function toCanvas(node: Node, options?: Options): Promise<HTMLCanvasElement>
  export default { toBlob, toPng, toJpeg, toSvg, toCanvas }
}
