import Phaser from 'phaser';

import { PONG_CONFIG } from '../config/pongConfig';

export class GameHud {
  private readonly roundedFont = 'Nunito, "Avenir Next Rounded", "Arial Rounded MT Bold", system-ui, sans-serif';
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly scoreGlowText: Phaser.GameObjects.Text;
  private readonly countdownText: Phaser.GameObjects.Text;
  private readonly pointText: Phaser.GameObjects.Text;
  private readonly messageText: Phaser.GameObjects.Text;
  private readonly winPanel: Phaser.GameObjects.Container;
  private readonly winTitleText: Phaser.GameObjects.Text;
  private readonly winSubtitleText: Phaser.GameObjects.Text;
  private readonly topAvatar: Phaser.GameObjects.Container;
  private readonly bottomAvatar: Phaser.GameObjects.Container;
  private readonly scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.scoreGlowText = this.scene.add.text(0, 0, '0 - 0', {
      fontFamily: this.roundedFont,
      fontSize: '74px',
      color: PONG_CONFIG.colors.text,
      fontStyle: '700',
    });
    this.scoreGlowText.setOrigin(0.5, 0);
    this.scoreGlowText.setAlpha(0.3);
    this.scoreGlowText.setStroke('#fff8ff', 16);

    this.scoreText = this.scene.add.text(0, 0, '0 - 0', {
      fontFamily: this.roundedFont,
      fontSize: '68px',
      color: PONG_CONFIG.colors.text,
      fontStyle: '700',
    });
    this.scoreText.setOrigin(0.5, 0);
    this.scoreText.setStroke('#fff8ff', 12);
    this.scoreText.setShadow(0, 0, '#FFB7E1', 20, false, true);

    this.countdownText = this.scene.add.text(0, 0, '', {
      fontFamily: this.roundedFont,
      fontSize: '112px',
      color: PONG_CONFIG.colors.text,
      fontStyle: '700',
    });
    this.countdownText.setOrigin(0.5);
    this.countdownText.setAlpha(0);
    this.countdownText.setStroke('#fff8ff', 16);
    this.countdownText.setShadow(0, 0, '#C8B6FF', 22, false, true);

    this.pointText = this.scene.add.text(0, 0, '', {
      fontFamily: this.roundedFont,
      fontSize: '26px',
      color: PONG_CONFIG.colors.text,
      fontStyle: '700',
    });
    this.pointText.setOrigin(0.5);
    this.pointText.setAlpha(0);
    this.pointText.setStroke('#fff8ff', 8);
    this.pointText.setShadow(0, 0, '#FF8DC7', 14, false, true);

    this.messageText = this.scene.add.text(0, 0, '', {
      fontFamily: this.roundedFont,
      fontSize: '18px',
      color: PONG_CONFIG.colors.mutedText,
      fontStyle: '700',
    });
    this.messageText.setOrigin(0.5);
    this.messageText.setAlpha(0);
    this.messageText.setLetterSpacing(1.5);

    this.topAvatar = this.createAvatarBadge('P2', 'TOP', PONG_CONFIG.colors.cyan);
    this.bottomAvatar = this.createAvatarBadge('P1', 'BOTTOM', PONG_CONFIG.colors.pink);

    const winBackdrop = this.scene.add.rectangle(0, 0, 440, 230, 0x050816, 0.92);
    winBackdrop.setFillStyle(0xfbf7ff, 0.94);
    winBackdrop.setStrokeStyle(2, 0xffb7e1, 0.7);
    winBackdrop.setRounded(24);

    this.winTitleText = this.scene.add.text(0, -34, 'WIN SCREEN', {
      fontFamily: this.roundedFont,
      fontSize: '18px',
      color: '#7B5CE6',
      fontStyle: '700',
    });
    this.winTitleText.setOrigin(0.5);
    this.winTitleText.setLetterSpacing(2);

    this.winSubtitleText = this.scene.add.text(0, 28, 'MATCH POINT PLACEHOLDER', {
      fontFamily: this.roundedFont,
      fontSize: '28px',
      color: '#7B5CE6',
      fontStyle: '700',
      align: 'center',
      wordWrap: { width: 360 },
    });
    this.winSubtitleText.setOrigin(0.5);

    this.winPanel = this.scene.add.container(0, 0, [winBackdrop, this.winTitleText, this.winSubtitleText]);
    this.winPanel.setAlpha(0);
    this.winPanel.setScale(0.96);

  }

  resize(width: number, height: number) {
    this.scoreGlowText.setPosition(width / 2, 54);
    this.scoreText.setPosition(width / 2, 54);
    this.countdownText.setPosition(width / 2, height / 2 - 10);
    this.pointText.setPosition(width / 2, height / 2 + 74);
    this.messageText.setPosition(width / 2, height / 2 + 112);
    this.winPanel.setPosition(width / 2, height / 2 - 8);
  }

  setAvatarPositions(topX: number, bottomX: number, topY: number, bottomY: number) {
    this.topAvatar.setPosition(topX, topY - 48);
    this.bottomAvatar.setPosition(bottomX, bottomY + 48);
  }

  setScore(topScore: number, bottomScore: number) {
    const score = `${topScore} - ${bottomScore}`;
    this.scoreText.setText(score);
    this.scoreGlowText.setText(score);

    this.scene.tweens.add({
      targets: [this.scoreText, this.scoreGlowText],
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 170,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
  }

  showCountdown(value: string) {
    this.countdownText.setText(value);
    this.countdownText.setAlpha(1);
    this.countdownText.setScale(0.84);

    this.scene.tweens.add({
      targets: this.countdownText,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 220,
      ease: 'Back.Out',
    });
  }

  hideCountdown() {
    this.countdownText.setAlpha(0);
  }

  showPointMessage(value: string) {
    this.pointText.setText(value);
    this.pointText.setAlpha(1);
    this.pointText.setScale(0.94);

    this.scene.tweens.add({
      targets: this.pointText,
      alpha: 0,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 520,
      ease: 'Quad.Out',
    });
  }

  hidePointMessage() {
    this.pointText.setAlpha(0);
  }

  showMessage(value: string) {
    this.messageText.setText(value);
    this.messageText.setAlpha(1);
  }

  hideMessage() {
    this.messageText.setAlpha(0);
  }

  showWinScreen(winner: string) {
    this.winSubtitleText.setText(`${winner} WINS`);
    this.winPanel.setAlpha(1);

    this.scene.tweens.add({
      targets: this.winPanel,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.Out',
    });
  }

  hideWinScreen() {
    this.winPanel.setAlpha(0);
  }

  destroy() {
    this.scoreGlowText.destroy();
    this.scoreText.destroy();
    this.countdownText.destroy();
    this.pointText.destroy();
    this.messageText.destroy();
    this.winPanel.destroy();
    this.topAvatar.destroy();
    this.bottomAvatar.destroy();
  }

  private createAvatarBadge(primary: string, secondary: string, tint: number) {
    const halo = this.scene.add.circle(0, 0, 26, tint, 0.18);
    halo.setStrokeStyle(2, tint, 0.55);

    const core = this.scene.add.circle(0, 0, 18, 0xffffff, 1);
    core.setStrokeStyle(2, tint, 0.65);

    const initials = this.scene.add.text(0, -2, primary, {
      fontFamily: this.roundedFont,
      fontSize: '16px',
      color: PONG_CONFIG.colors.text,
      fontStyle: '700',
    });
    initials.setOrigin(0.5);

    const label = this.scene.add.text(0, 34, secondary, {
      fontFamily: this.roundedFont,
      fontSize: '11px',
      color: tint === PONG_CONFIG.colors.cyan ? '#8b71ff' : '#ff8dc7',
      fontStyle: '700',
    });
    label.setOrigin(0.5);
    label.setLetterSpacing(1.4);

    const container = this.scene.add.container(0, 0, [halo, core, initials, label]);
    container.setScale(1);
    return container;
  }
}