// Square viewport that shows an image zoomed in on a focal point.
//
// The image is laid out at "cover" size for the square frame, then moved with
// translate()+scale() so the focal point sits as close to the centre as it can
// without exposing the frame's background. Both endpoints of every transition
// cover the frame and CSS interpolates translate and scale linearly, so the
// in-between frames cover it too.

export class ZoomView {
  private img: HTMLImageElement;
  private aspect = 1;
  private focal = { x: 0.5, y: 0.5 };
  private zoom = 1;

  constructor(private frame: HTMLElement) {
    this.img = document.createElement('img');
    this.img.className = 'zoom-img';
    this.img.alt = 'Mystery zombies map screenshot';
    this.img.draggable = false;
    frame.append(this.img);
  }

  /** Loads a new image and jumps (no animation) to `zoom`. */
  async show(src: string, focalX: number, focalY: number, zoom: number): Promise<void> {
    this.frame.classList.remove('revealed');
    this.frame.style.removeProperty('aspect-ratio');
    this.frame.classList.add('loading', 'no-anim');
    this.img.src = src;
    await this.img.decode().catch(() => undefined);
    this.aspect = this.img.naturalWidth && this.img.naturalHeight ? this.img.naturalWidth / this.img.naturalHeight : 1;
    this.focal = { x: clamp01(focalX), y: clamp01(focalY) };
    this.setZoom(zoom);
    void this.frame.offsetWidth; // commit the un-animated transform before re-enabling transitions
    this.frame.classList.remove('loading', 'no-anim');
  }

  setZoom(zoom: number): void {
    this.zoom = Math.max(1, zoom);
    // Image size in units of the (square) frame at zoom 1.
    const w = Math.max(1, this.aspect);
    const h = Math.max(1, 1 / this.aspect);
    const left = offset(w * this.zoom, this.focal.x);
    const top = offset(h * this.zoom, this.focal.y);
    this.img.style.width = `${w * 100}%`;
    this.img.style.height = `${h * 100}%`;
    // translate() percentages are of the element's own (unscaled) box.
    this.img.style.transform = `translate(${(left / w) * 100}%, ${(top / h) * 100}%) scale(${this.zoom})`;
  }

  /** End of round: animate to the full, uncropped image at its native aspect ratio. */
  reveal(): void {
    this.frame.classList.add('revealed');
    this.frame.style.aspectRatio = String(this.aspect);
    this.img.style.width = '100%';
    this.img.style.height = '100%';
    this.img.style.transform = 'translate(0, 0) scale(1)';
  }
}

/** Left/top edge (frame units) that centres `focal`, clamped so the image still covers [0, 1]. */
function offset(size: number, focal: number): number {
  const ideal = 0.5 - focal * size;
  return Math.min(0, Math.max(1 - size, ideal));
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
}
