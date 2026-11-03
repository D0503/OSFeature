const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff])

export function imageExt(content) {
  if (content.subarray(0, 8).equals(PNG_MAGIC)) return "png"
  if (content.subarray(0, 3).equals(JPEG_MAGIC)) return "jpg"
  return null
}
