/**
 * NOX mascot component. No build step or external runtime requests.
 * Model viewer is vendored locally; the supplied GLB needs no remote decoders.
 */
const viewerModule = new URL('../vendor/model-viewer-4.4.0.min.js', import.meta.url);
let viewerReady;

export class NoxMascot extends HTMLElement {
  static observedAttributes = ['background'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._loaded = false;
    this._failed = false;
    this._visible = true;
    this._motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    this._reduced = this._motionPreference.matches || this.hasAttribute('reduced-motion');
    this._wantedPlaying = !this._reduced;
    this._clip = this.getAttribute('clip') || 'Idle';
    this._animationRequest = 0;
    this._switchingAnimation = false;
    this._onVisibility = () => this._syncPlayback();
    this._onPreference = event => this.setReducedMotion(event.matches);
  }

  connectedCallback() {
    if (this._started) {
      this._intersection?.observe(this);
      document.addEventListener('visibilitychange', this._onVisibility);
      this._motionPreference.addEventListener('change', this._onPreference);
      this._syncPlayback();
      return;
    }
    this._started = true;
    const poster = this.getAttribute('poster') || '';
    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; position:relative; width:100%; min-height:320px; isolation:isolate; }
        .stage { position:absolute; inset:0; overflow:hidden; background:var(--nox-stage-background,transparent); }
        .fallback { position:absolute; inset:0; z-index:1; display:grid; place-items:center; pointer-events:none; transition:opacity .35s ease; }
        ::slotted([slot="fallback"]), .fallback > img { width:100%; height:100%; object-fit:contain; display:block; }
        model-viewer { display:block; width:100%; height:100%; min-height:320px; background:transparent; opacity:0; --poster-color:transparent; --progress-bar-color:#f14452; --progress-bar-height:2px; }
        :host([data-loaded]) model-viewer { opacity:1; }
        :host([data-loaded]) .fallback { opacity:0; visibility:hidden; }
        :host([background="light"]) .stage { background:#e8e5df; }
        :host([background="dark"]) .stage { background:radial-gradient(ellipse at 51% 44%,#25282c 0%,#16181b 48%,#101114 85%); }
        :host([background="transparent"]) .stage { background-color:#c6c6c6; background-image:linear-gradient(45deg,#e1e1e1 25%,transparent 25%),linear-gradient(-45deg,#e1e1e1 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e1e1e1 75%),linear-gradient(-45deg,transparent 75%,#e1e1e1 75%); background-size:28px 28px; background-position:0 0,0 14px,14px -14px,-14px 0; }
        .hint { position:absolute; inset:auto 16px 14px; z-index:2; margin:0; text-align:center; color:var(--nox-hint-color,#a4a7ad); font:11px/1.5 system-ui,sans-serif; letter-spacing:.025em; pointer-events:none; }
        :host([background="light"]) .hint,:host([background="transparent"]) .hint { color:#52555b; }
        @media(prefers-reduced-motion:reduce) { .fallback { transition:none; } }
      </style>
      <div class="stage" part="stage">
        <div class="fallback" part="fallback"><slot name="fallback"></slot></div>
        <model-viewer inert aria-hidden="true" part="viewer" alt="NOX mascot: an ivory armoured robot with a black visor and red accents." environment-image="neutral" exposure="1.15" tone-mapping="aces" shadow-intensity="0.6" shadow-softness="1" camera-orbit="26deg 80deg ${window.innerWidth <= 820 ? 105 : 90}%" camera-target="0m 2.9m 0m" field-of-view="30deg" min-camera-orbit="auto 20deg 65%" max-camera-orbit="auto 110deg 180%" interaction-prompt="none" touch-action="pan-y" animation-crossfade-duration="350" loading="eager" reveal="auto"></model-viewer>
        <p class="hint" aria-hidden="true">Preparing NOX…</p>
      </div>`;

    const fallbackSlot = this.shadowRoot.querySelector('slot');
    if (!this.querySelector('[slot="fallback"]') && poster) {
      const image = document.createElement('img');
      image.src = poster;
      image.alt = this.getAttribute('alt') || 'NOX mascot';
      fallbackSlot.append(image);
    }
    this.viewer = this.shadowRoot.querySelector('model-viewer');
    this.hint = this.shadowRoot.querySelector('.hint');
    // Keep the homepage mascot free of viewer instructions.
    this.hint.hidden = true;

    // Let scrolling and touch gestures pass through to the page.
    this.viewer.style.pointerEvents = 'none';
    if (poster) this.viewer.setAttribute('poster', poster);
    this.viewer.addEventListener('load', () => this._onLoad());
    this.viewer.addEventListener('error', () => this._onError());
    this.viewer.addEventListener('play', () => this._emitState());
    this.viewer.addEventListener('pause', () => this._emitState());
    this.viewer.addEventListener('finished', () => {
      if (this._clip === 'PowerUp') this.playAnimation('Idle');
    });
    this.viewer.addEventListener('camera-change', event => {
      if (event.detail?.source === 'user-interaction') this.hint.textContent = 'Drag to explore · Pinch or scroll to zoom';
    });
    this._intersection = new IntersectionObserver(entries => {
      this._visible = entries[0]?.isIntersecting ?? true;
      this._syncPlayback();
    }, { threshold: 0.05 });
    this._intersection.observe(this);
    document.addEventListener('visibilitychange', this._onVisibility);
    this._motionPreference.addEventListener('change', this._onPreference);
    this._emitState();
    this._loadViewer();
  }

  disconnectedCallback() {
    this._intersection?.disconnect();
    document.removeEventListener('visibilitychange', this._onVisibility);
    this._motionPreference.removeEventListener('change', this._onPreference);
    this.viewer?.pause?.();
  }

  attributeChangedCallback(name, previous, next) {
    if (previous !== next && name === 'background') this._emitState();
  }

  async _loadViewer() {
    try {
      viewerReady ??= import(viewerModule.href);
      await viewerReady;
      await customElements.whenDefined('model-viewer');
      this.viewer.setAttribute('src', this.getAttribute('src') || '');
    } catch (error) {
      console.warn('NOX 3D preview could not start. The still image remains available.', error);
      this._onError();
    }
  }

  async _onLoad() {
    this._loaded = true;
    this._failed = false;
    this._animations = [...this.viewer.availableAnimations];
    this._clip = this._animations.includes(this._clip) ? this._clip : this._animations[0] || '';
    this.viewer.animationName = this._clip;
    await this.viewer.updateComplete;
    // Frame the actual animated pose, rather than the export's controller rest pose.
    this.viewer.currentTime = 0;
    await this.viewer.updateFraming();
    this.viewer.jumpCameraToGoal();
    this.viewer.removeAttribute('inert');
    this.viewer.removeAttribute('aria-hidden');
    requestAnimationFrame(() => this.setAttribute('data-loaded', ''));
    this.hint.textContent = 'Drag to explore · Pinch or scroll to zoom';
    this._syncPlayback();
    this.dispatchEvent(new CustomEvent('nox-ready', { bubbles:true, composed:true, detail:this.state }));
  }

  _onError() {
    this._failed = true;
    this._loaded = false;
    this._switchingAnimation = false;
    this.removeAttribute('data-loaded');
    this.viewer?.setAttribute('inert', '');
    this.viewer?.setAttribute('aria-hidden', 'true');
    this.hint.textContent = 'Still preview · 3D is unavailable in this browser';
    this._emitState();
  }

  _syncPlayback() {
    if (!this._loaded) return this._emitState();
    if (this.hasAttribute('scroll-driven')) {
  this.setScrollProgress(this._scrollProgress ?? 0);
  this._emitState();
  return;
}
    if (!this._switchingAnimation && this._wantedPlaying && !this._reduced && this._visible && this.isConnected && !document.hidden) {
      this.viewer.play(this._clip === 'PowerUp' ? { repetitions:1 } : {});
    }
    else this.viewer.pause();
    this._emitState();
  }

  setScrollProgress(progress) {
  const value = Number(progress);

  if (!Number.isFinite(value)) return;

  this._scrollProgress = Math.max(0, Math.min(1, value));

  if (!this._loaded || !this.hasAttribute('scroll-driven')) return;

  this.viewer.pause();

  const duration = this.viewer.duration;

  if (!Number.isFinite(duration) || duration <= 0) return;

  const end = Math.max(0, duration - 0.001);

  this.viewer.currentTime = this._reduced
    ? 0
    : this._scrollProgress * end;
}
setCameraView(angle, distance) {
  if (!this._loaded) return;

  this.viewer.cameraOrbit = `${angle}deg 80deg ${distance}%`;

  if (this._reduced) {
    this.viewer.jumpCameraToGoal();
  }
}

  _emitState() {
    this.dispatchEvent(new CustomEvent('nox-state', { bubbles:true, composed:true, detail:this.state }));
  }

  get state() {
    return {
      ready:this._loaded, failed:this._failed, clip:this._clip,
      animations:this._animations || [], playing:this._loaded && !this.viewer?.paused,
      wantsPlayback:this._wantedPlaying, reducedMotion:this._reduced,
      background:this.getAttribute('background') || 'inherit'
    };
  }

  async playAnimation(name, { play = false } = {}) {
    if (!this._loaded || !this._animations.includes(name)) return false;
    const request = ++this._animationRequest;
    this._switchingAnimation = true;
    // Select while paused so the viewer clears the previous action's fades.
    // Seeking a running crossfade rewinds its clock and can hide the new clip.
    this.viewer.pause();
    this._clip = name;
    this.viewer.animationName = name;
    await this.viewer.updateComplete;
    if (request !== this._animationRequest || !this._loaded) return false;
    this.viewer.currentTime = 0;
    this._switchingAnimation = false;
    if (play) {
      this._wantedPlaying = true;
      this._reduced = false;
    }
    this._syncPlayback();
    return true;
  }

  togglePlayback() {
    if (!this._loaded) return;
    this._wantedPlaying = !this._wantedPlaying;
    if (this._wantedPlaying) this._reduced = false;
    this._syncPlayback();
  }

  setReducedMotion(enabled) {
    this._reduced = Boolean(enabled);
    this._wantedPlaying = !this._reduced;
    this._syncPlayback();
  }

  setBackground(name) {
    if (['dark','light','transparent','inherit'].includes(name)) this.setAttribute('background',name);
  }

  resetCamera() {
    if (!this._loaded) return;
    this.viewer.cameraOrbit = '25deg 80deg 105%';
    this.viewer.cameraTarget = '0m 2.9m 0m';
    this.viewer.fieldOfView = '30deg';
    this.viewer.resetTurntableRotation();
    if (this._reduced) this.viewer.jumpCameraToGoal();
  }
}

if (!customElements.get('nox-mascot')) customElements.define('nox-mascot', NoxMascot);
