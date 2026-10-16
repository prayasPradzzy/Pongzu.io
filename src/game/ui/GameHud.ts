import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../utils/sceneSetup';

const FONT = 'Nunito, "Avenir Next Rounded", "Arial Rounded MT Bold", system-ui, sans-serif';

export const HINT_STORAGE_KEY = 'pongzu-controls-hint-seen';

/** Text for the first-match controls hint on this device. */
export function controlsHint(touch: boolean): string {
  return touch ? '👆 Drag anywhere to move your paddle' : 'Move with ← → or A D  ·  or click and drag';
}

export function hasSeenControlsHint(): boolean {
  try {
    return localStorage.getItem(HINT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markControlsHintSeen() {
  try {
    localStorage.setItem(HINT_STORAGE_KEY, '1');
  } catch {
    // not persisted
  }
}

export type HudOptions = {
  topName: string;
  bottomName: string;
  showPing: boolean;
  /** Same-device play: player 2 sits across the table, so flip their label. */
  faceTopPlayer: boolean;
  /** CPU matches offer a "change difficulty" button on the result card. */
  showChangeDifficulty: boolean;
  playAgainLabel: string;
};

export type WinScreenContent = {
  victory: boolean;
  title: string;
  subtitle: string;
  lines: string[];
  /** Texture of whoever lost — shown squashed on the card. */
  loserFaceKey: string | null;
};

/**
 * Everything drawn on top of the arena. All positions are in the 600×1000
 * logical arena. "Top" is always the opponent and "bottom" the local player.
 */
export class GameHud {
  private readonly scene: Phaser.Scene;
  private readonly topScoreText: Phaser.GameObjects.Text;
  private readonly bottomScoreText: Phaser.GameObjects.Text;
  private readonly countdownText: Phaser.GameObjects.Text;
  private readonly pointText: Phaser.GameObjects.Text;
  private readonly messageText: Phaser.GameObjects.Text;
  private readonly bannerText: Phaser.GameObjects.Text;
  private readonly topNameLabel: Phaser.GameObjects.Text;
  private readonly bottomNameLabel: Phaser.GameObjects.Text;
  private readonly exitButton: Phaser.GameObjects.Container;
  private readonly pingText?: Phaser.GameObjects.Text;

  private readonly winPanel: Phaser.GameObjects.Container;
  private readonly winTitleText: Phaser.GameObjects.Text;
  private readonly winSubtitleText: Phaser.GameObjects.Text;
  private readonly winStatsText: Phaser.GameObjects.Text;
  private readonly playAgainBg: Phaser.GameObjects.Rectangle;
  private readonly playAgainText: Phaser.GameObjects.Text;
  private loserFace: Phaser.GameObjects.Image | null = null;
  private hint: Phaser.GameObjects.Container | null = null;
  private topScore = -1;
  private bottomScore = -1;

  constructor(scene: Phaser.Scene, options: HudOptions) {
    this.scene = scene;
    const W = ARENA_WIDTH;
    const H = ARENA_HEIGHT;

    // ── Scores: one big, faint number in each half (classic Pong) ──
    const scoreStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize: '170px',
      fontStyle: '900',
      color: PONG_CONFIG.colors.text,
    };
    this.topScoreText = scene.add.text(W / 2, H * 0.27, '0', scoreStyle).setOrigin(0.5).setAlpha(0.13).setDepth(1);
    this.bottomScoreText = scene.add.text(W / 2, H * 0.73, '0', scoreStyle).setOrigin(0.5).setAlpha(0.13).setDepth(1);
    if (options.faceTopPlayer) this.topScoreText.setAngle(180);

    // ── Centre messages ──
    this.countdownText = scene.add
      .text(W / 2, H / 2, '', {
        fontFamily: FONT,
        fontSize: '140px',
        fontStyle: '900',
        color: PONG_CONFIG.colors.text,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setStroke('#ffffff', 18)
      .setDepth(30);

    this.pointText = scene.add
      .text(W / 2, H / 2 + 112, '', {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: '900',
        color: PONG_CONFIG.colors.text,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setStroke('#ffffff', 10)
      .setDepth(30);

    this.messageText = scene.add
      .text(W / 2, H / 2 + 158, '', {
        fontFamily: FONT,
        fontSize: '20px',
        fontStyle: '800',
        color: PONG_CONFIG.colors.mutedText,
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setLetterSpacing(2)
      .setDepth(30);

    this.bannerText = scene.add
      .text(W / 2, H / 2 - 130, '', {
        fontFamily: FONT,
        fontSize: '46px',
        fontStyle: '900',
        color: '#ff4fa3',
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0)
      .setStroke('#ffffff', 12)
      .setDepth(31);

    // ── Names follow the paddles ──
    this.topNameLabel = this.createNameLabel(options.topName, PONG_CONFIG.colors.paddleTop);
    this.bottomNameLabel = this.createNameLabel(options.bottomName, PONG_CONFIG.colors.paddleBottom);
    if (options.faceTopPlayer) this.topNameLabel.setAngle(180);

    // ── Exit button ──
    const exitBg = scene.add.circle(0, 0, 22, 0xffffff, 0.85).setStrokeStyle(2, PONG_CONFIG.colors.frame, 1);
    exitBg.setInteractive({ useHandCursor: true });
    const exitText = scene.add
      .text(0, 0, '✕', { fontFamily: FONT, fontSize: '20px', fontStyle: '900', color: '#7c5cff' })
      .setOrigin(0.5);
    this.exitButton = scene.add.container(W - 54, 54, [exitBg, exitText]).setDepth(100);
    exitBg.on('pointerdown', () => scene.events.emit('exit-match'));

    if (options.showPing) {
      this.pingText = scene.add
        .text(40, 44, 'Ping —', { fontFamily: FONT, fontSize: '15px', fontStyle: '800', color: '#8F78E8' })
        .setDepth(100);
    }

    // ── Result card ──
    const panelBg = scene.add.rectangle(0, 0, 480, 540, 0xfffaff, 0.97);
    panelBg.setStrokeStyle(3, 0xff8dc7, 0.9);
    panelBg.setRounded(32);

    this.winTitleText = scene.add
      .text(0, -88, 'VICTORY', { fontFamily: FONT, fontSize: '22px', fontStyle: '900', color: '#7B5CE6' })
      .setOrigin(0.5)
      .setLetterSpacing(6);

    this.winSubtitleText = scene.add
      .text(0, -48, '', {
        fontFamily: FONT,
        fontSize: '36px',
        fontStyle: '900',
        color: '#5B3FD6',
        align: 'center',
        wordWrap: { width: 420 },
      })
      .setOrigin(0.5);

    this.winStatsText = scene.add
      .text(0, 26, '', {
        fontFamily: FONT,
        fontSize: '18px',
        fontStyle: '700',
        color: '#8F78E8',
        align: 'center',
        lineSpacing: 8,
      })
      .setOrigin(0.5);

    const button = (y: number, label: string, primary: boolean) => {
      const bg = scene.add.rectangle(0, y, 340, 54, primary ? 0x7c5cff : 0xffffff, 1);
      bg.setRounded(27);
      if (!primary) bg.setStrokeStyle(2, 0xff8dc7, 1);
      bg.setInteractive({ useHandCursor: true });
      const text = scene.add
        .text(0, y, label, {
          fontFamily: FONT,
          fontSize: '17px',
          fontStyle: '900',
          color: primary ? '#ffffff' : '#ff4fa3',
        })
        .setOrigin(0.5)
        .setLetterSpacing(1.5);
      bg.on('pointerover', () => {
        bg.setScale(1.03);
        text.setScale(1.03);
      });
      bg.on('pointerout', () => {
        bg.setScale(1);
        text.setScale(1);
      });
      return { bg, text };
    };

    const playAgain = button(118, options.playAgainLabel, true);
    playAgain.bg.on('pointerdown', () => scene.events.emit('rematch'));
    this.playAgainBg = playAgain.bg;
    this.playAgainText = playAgain.text;

    const children: Phaser.GameObjects.GameObject[] = [
      panelBg,
      this.winTitleText,
      this.winSubtitleText,
      this.winStatsText,
      playAgain.bg,
      playAgain.text,
    ];

    let nextY = 184;
    if (options.showChangeDifficulty) {
      const change = button(nextY, 'CHANGE DIFFICULTY', false);
      change.bg.on('pointerdown', () => this.scene.registry.get('customConfig')?.onChangeDifficulty?.());
      children.push(change.bg, change.text);
      nextY += 62;
    }
    const menu = button(nextY, 'MAIN MENU', false);
    menu.bg.on('pointerdown', () => scene.events.emit('exit-match'));
    children.push(menu.bg, menu.text);

    this.winPanel = scene.add.container(W / 2, H / 2, children).setDepth(50).setAlpha(0).setVisible(false);
  }

  setNamePositions(topX: number, bottomX: number) {
    this.topNameLabel.setPosition(topX, PONG_CONFIG.paddle.topOffset - 34);
    this.bottomNameLabel.setPosition(bottomX, ARENA_HEIGHT - PONG_CONFIG.paddle.bottomOffset + 34);
  }

  setPing(pingMs: number) {
    if (!this.pingText) return;
    this.pingText.setText(pingMs > 0 ? `Ping ${Math.round(pingMs)}ms` : 'Ping —');
    this.pingText.setColor(pingMs < 90 ? '#8F78E8' : pingMs < 160 ? '#D9A21B' : '#E65C5C');
  }

  /** top = opponent, bottom = local player. The side that just changed pops. */
  setScore(topScore: number, bottomScore: number) {
    if (topScore !== this.topScore) this.popScore(this.topScoreText, topScore, this.topScore >= 0);
    if (bottomScore !== this.bottomScore) this.popScore(this.bottomScoreText, bottomScore, this.bottomScore >= 0);
    this.topScore = topScore;
    this.bottomScore = bottomScore;
  }

  showCountdown(value: string, isGo?: boolean) {
    this.countdownText.setText(value);
    this.countdownText.setColor(isGo ? '#FF4FA3' : PONG_CONFIG.colors.text);
    this.countdownText.setAlpha(1).setScale(0.6);
    this.scene.tweens.killTweensOf(this.countdownText);
    this.scene.tweens.add({ targets: this.countdownText, scale: 1, duration: 260, ease: 'Back.Out' });
    if (isGo) {
      this.scene.tweens.add({ targets: this.countdownText, alpha: 0, scale: 1.5, delay: 260, duration: 260 });
    }
  }

  hideCountdown() {
    this.scene.tweens.killTweensOf(this.countdownText);
    this.countdownText.setAlpha(0);
  }

  showPointMessage(value: string) {
    this.pointText.setText(value).setAlpha(1).setScale(0.8);
    this.scene.tweens.killTweensOf(this.pointText);
    this.scene.tweens.add({ targets: this.pointText, scale: 1, duration: 200, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: this.pointText, alpha: 0, delay: 900, duration: 300 });
  }

  hidePointMessage() {
    this.scene.tweens.killTweensOf(this.pointText);
    this.pointText.setAlpha(0);
  }

  showMessage(value: string) {
    this.messageText.setText(value).setAlpha(1);
  }

  hideMessage() {
    this.messageText.setAlpha(0);
  }

  /** Big celebratory line, e.g. "MATCH POINT" or "20 RALLY!". */
  showBanner(value: string, color = '#FF4FA3') {
    this.bannerText.setText(value).setColor(color).setAlpha(1).setScale(0.4).setAngle(-4);
    this.scene.tweens.killTweensOf(this.bannerText);
    this.scene.tweens.add({ targets: this.bannerText, scale: 1, angle: 0, duration: 320, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: this.bannerText, alpha: 0, delay: 1100, duration: 400 });
  }

  /** Small number that floats up from a paddle (rally counter). */
  popText(value: string, x: number, y: number, rising: boolean) {
    const text = this.scene.add
      .text(x, y, value, { fontFamily: FONT, fontSize: '26px', fontStyle: '900', color: '#FF4FA3' })
      .setOrigin(0.5)
      .setStroke('#ffffff', 8)
      .setDepth(32);
    this.scene.tweens.add({
      targets: text,
      y: y + (rising ? -60 : 60),
      alpha: 0,
      scale: 1.3,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  /** Controls hint in a pill near the player's paddle; stays until hideHint(). */
  showHint(value: string) {
    this.hideHint();
    const text = this.scene.add
      .text(0, 0, value, {
        fontFamily: FONT,
        fontSize: '19px',
        fontStyle: '800',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 460 },
      })
      .setOrigin(0.5);
    const bg = this.scene.add.rectangle(0, 0, text.width + 44, text.height + 22, 0x5b3fd6, 0.88);
    bg.setRounded((text.height + 22) / 2);
    this.hint = this.scene.add
      .container(ARENA_WIDTH / 2, ARENA_HEIGHT - PONG_CONFIG.paddle.bottomOffset - 110, [bg, text])
      .setDepth(40);
    this.scene.tweens.add({ targets: this.hint, y: this.hint.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  hideHint() {
    if (!this.hint) return;
    const hint = this.hint;
    this.hint = null;
    this.scene.tweens.killTweensOf(hint);
    this.scene.tweens.add({ targets: hint, alpha: 0, duration: 250, onComplete: () => hint.destroy() });
  }

  /** Relabel the result card's primary button (e.g. while waiting on a rematch vote). */
  setPlayAgainLabel(label: string, enabled = true) {
    this.playAgainText.setText(label);
    this.playAgainBg.setFillStyle(enabled ? 0x7c5cff : 0xc4b8ec, 1);
    if (enabled) this.playAgainBg.setInteractive({ useHandCursor: true });
    else this.playAgainBg.disableInteractive();
  }

  showWinScreen(content: WinScreenContent) {
    this.winTitleText.setText(content.title).setColor(content.victory ? '#7B5CE6' : '#E65C5C');
    this.winSubtitleText.setText(content.subtitle).setColor(content.victory ? '#5B3FD6' : '#D94848');
    this.winStatsText.setText(content.lines.join('\n'));

    this.loserFace?.destroy();
    this.loserFace = null;
    if (content.loserFaceKey && this.scene.textures.exists(content.loserFaceKey)) {
      // The loser's face, squashed flat and wobbling. Petty, and the point of the game.
      const face = this.scene.add.image(0, -178, content.loserFaceKey).setDisplaySize(120, 120);
      const base = face.scaleX;
      face.setScale(base * 1.35, base * 0.55);
      this.scene.tweens.add({
        targets: face,
        scaleX: base * 1.2,
        scaleY: base * 0.68,
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.winPanel.addAt(face, 1);
      this.loserFace = face;
    }

    this.winPanel.setVisible(true).setAlpha(1).setScale(0.85);
    this.scene.tweens.add({ targets: this.winPanel, scale: 1, duration: 320, ease: 'Back.Out' });
  }

  hideWinScreen() {
    this.winPanel.setVisible(false).setAlpha(0);
    this.loserFace?.destroy();
    this.loserFace = null;
  }

  destroy() {
    [
      this.topScoreText,
      this.bottomScoreText,
      this.countdownText,
      this.pointText,
      this.messageText,
      this.bannerText,
      this.topNameLabel,
      this.bottomNameLabel,
    ].forEach((text) => {
      this.scene.tweens.killTweensOf(text);
      text.destroy();
    });
    this.hint?.destroy();
    this.winPanel.destroy();
    this.exitButton.destroy();
    this.pingText?.destroy();
  }

  private popScore(text: Phaser.GameObjects.Text, value: number, animate: boolean) {
    text.setText(String(value));
    if (!animate) return;
    this.scene.tweens.killTweensOf(text);
    text.setAlpha(0.45).setScale(1.25);
    this.scene.tweens.add({ targets: text, alpha: 0.13, scale: 1, duration: 700, ease: 'Quad.easeOut' });
  }

  private createNameLabel(name: string, color: number) {
    const label = this.scene.add.text(0, 0, name.toUpperCase(), {
      fontFamily: FONT,
      fontSize: '17px',
      fontStyle: '900',
      color: '#' + color.toString(16).padStart(6, '0'),
    });
    label.setOrigin(0.5).setLetterSpacing(2).setStroke('#ffffff', 6).setDepth(6);
    return label;
  }
}
