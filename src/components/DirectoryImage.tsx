export function DirectoryImage({ src }: { src?: string }) {
  return <td className="directory-image-cell">
    {src ? <img src={src} alt="" loading="lazy" /> : '—'}
  </td>
}
