import Phaser from 'phaser';

import { PONG_CONFIG, DIFFICULTY_PRESETS, type Difficulty } from '../config/pongConfig';

export type MatchStats = {
  topScore: number;
  bottomScore: number;
  longestRally: number;
};

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
  private readonly winStatsText: Phaser.GameObjects.Text;
  private readonly topNameLabel: Phaser.GameObjects.Text;
  private readonly bottomNameLabel: Phaser.GameObjects.Text;
  private readonly exitButtonContainer: Phaser.GameObjects.Container;

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

    const config = this.scene.registry.get('customConfig');
    const p1Name = config?.playerName || 'PLAYER';
    const p2Name = config?.mode === 'online' ? (config?.opponentName || 'OPPONENT') : 'CPU';

    this.topNameLabel = this.createNameLabel(p2Name, PONG_CONFIG.colors.cyan);
    this.bottomNameLabel = this.createNameLabel(p1Name, PONG_CONFIG.colors.pink);

    // Build exit button
    const exitBg = this.scene.add.circle(0, 0, 16, 0x000000, 0.2);
    exitBg.setInteractive({ useHandCursor: true });
    
    const exitText = this.scene.add.text(0, 0, '✕', {
      fontFamily: 'system-ui, sans-serif',
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    exitText.setOrigin(0.5);
    
    this.exitButtonContainer = this.scene.add.container(0, 0, [exitBg, exitText]);
    this.exitButtonContainer.setAlpha(0.6);
    this.exitButtonContainer.setDepth(100);
    
    exitBg.on('pointerover', () => { this.exitButtonContainer.setAlpha(1); exitBg.setScale(1.1); exitText.setScale(1.1); });
    exitBg.on('pointerout', () => { this.exitButtonContainer.setAlpha(0.6); exitBg.setScale(1); exitText.setScale(1); });
    exitBg.on('pointerdown', () => { this.scene.events.emit('exit-match'); });

    // Build win panel
    const winBackdrop = this.scene.add.rectangle(0, 0, 440, 380, 0x050816, 0.92);
    winBackdrop.setFillStyle(0xfbf7ff, 0.96);
    winBackdrop.setStrokeStyle(2, 0xffb7e1, 0.7);
    winBackdrop.setRounded(24);

    this.winTitleText = this.scene.add.text(0, -126, 'VICTORY', {
      fontFamily: this.roundedFont,
      fontSize: '20px',
      color: '#7B5CE6',
      fontStyle: '800',
    });
    this.winTitleText.setOrigin(0.5);
    this.winTitleText.setLetterSpacing(4);

    this.winSubtitleText = this.scene.add.text(0, -88, 'YOU WIN!', {
      fontFamily: this.roundedFont,
      fontSize: '32px',
      color: '#7B5CE6',
      fontStyle: '800',
      align: 'center',
      wordWrap: { width: 360 },
    });
    this.winSubtitleText.setOrigin(0.5);

    this.winStatsText = this.scene.add.text(0, -28, '', {
      fontFamily: this.roundedFont,
      fontSize: '15px',
      color: '#9A84E8',
      fontStyle: '600',
      align: 'center',
      lineSpacing: 8,
    });
    this.winStatsText.setOrigin(0.5);
    
    const divider = this.scene.add.rectangle(0, 30, 320, 2, 0xc8b6ff, 0.3);

    const isOnline = config?.mode === 'online';

    // Buttons
    const playBg = this.scene.add.rectangle(0, 76, 280, 42, 0x7b5ce6, 1);
    playBg.setRounded(21);
    playBg.setInteractive({ useHandCursor: true });

    const playText = this.scene.add.text(0, 76, 'PLAY AGAIN', {
      fontFamily: this.roundedFont,
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: '800',
    });
    playText.setOrigin(0.5);
    playText.setLetterSpacing(1.5);

    const diffBg = this.scene.add.rectangle(0, 128, 280, 42, 0xffffff, 1);
    diffBg.setStrokeStyle(2, 0x7b5ce6, 1);
    diffBg.setRounded(21);
    diffBg.setInteractive({ useHandCursor: true });

    const diffText = this.scene.add.text(0, 128, 'CHANGE DIFFICULTY', {
      fontFamily: this.roundedFont,
      fontSize: '13px',
      color: '#7b5ce6',
      fontStyle: '800',
    });
    diffText.setOrigin(0.5);
    diffText.setLetterSpacing(1.5);

    const returnBg = this.scene.add.rectangle(0, isOnline ? 128 : 180, 280, 42, 0xffffff, 1);
    returnBg.setStrokeStyle(2, 0xff8dc7, 1);
    returnBg.setRounded(21);
    returnBg.setInteractive({ useHandCursor: true });

    const returnText = this.scene.add.text(0, isOnline ? 128 : 180, 'RETURN TO MENU', {
      fontFamily: this.roundedFont,
      fontSize: '13px',
      color: '#ff8dc7',
      fontStyle: '800',
    });
    returnText.setOrigin(0.5);
    returnText.setLetterSpacing(1.5);

    // Event listeners
    playBg.on('pointerdown', () => {
      this.scene.events.emit('rematch');
    });

    diffBg.on('pointerdown', () => {
      const customConfig = this.scene.registry.get('customConfig');
      if (customConfig?.onChangeDifficulty) {
        customConfig.onChangeDifficulty();
      }
    });

    returnBg.on('pointerdown', () => {
      this.scene.events.emit('exit-match');
    });

    // Hover effects
    const addHover = (bg: Phaser.GameObjects.Rectangle, txt: Phaser.GameObjects.Text) => {
      bg.on('pointerover', () => { bg.setScale(1.03); txt.setScale(1.03); });
      bg.on('pointerout', () => { bg.setScale(1); txt.setScale(1); });
    };
    addHover(playBg, playText);
    addHover(diffBg, diffText);
    addHover(returnBg, returnText);

    const winPanelChildren: any[] = [
      winBackdrop,
      this.winTitleText,
      this.winSubtitleText,
      this.winStatsText,
      divider,
      playBg,
      playText,
      returnBg,
      returnText,
    ];
    
    if (!isOnline) {
      winPanelChildren.push(diffBg, diffText);
    } else {
      diffBg.destroy();
      diffText.destroy();
    }

    this.winPanel = this.scene.add.container(0, 0, winPanelChildren);
    this.winPanel.setAlpha(0);
    this.winPanel.setScale(0.96);
    this.winPanel.setDepth(50);

  }

  resize(width: number, height: number) {
    this.scoreGlowText.setPosition(width / 2, 54);
    this.scoreText.setPosition(width / 2, 54);
    this.countdownText.setPosition(width / 2, height / 2 - 10);
    this.pointText.setPosition(width / 2, height / 2 + 74);
    this.messageText.setPosition(width / 2, height / 2 + 112);
    this.winPanel.setPosition(width / 2, height / 2 - 8);
    this.exitButtonContainer.setPosition(width - 32, 32);
  }

  setNamePositions(topX: number, bottomX: number, topY: number, bottomY: number) {
    this.topNameLabel.setPosition(topX, topY - 32);
    this.bottomNameLabel.setPosition(bottomX, bottomY + 32);
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

  showWinScreen(outcome: 'victory' | 'defeat', stats: MatchStats) {
    const config = this.scene.registry.get('customConfig');
    const playerName = config?.playerName ?? 'Player';
    const difficulty = config?.difficulty as Difficulty ?? 'medium';
    const diffLabel = DIFFICULTY_PRESETS[difficulty].label;

    if (outcome === 'victory') {
      this.winTitleText.setText('🏆 VICTORY');
      this.winTitleText.setColor('#7B5CE6');
      this.winSubtitleText.setText(`${playerName} wins!`);
      this.winSubtitleText.setColor('#7B5CE6');
    } else {
      this.winTitleText.setText('💀 DEFEAT');
      this.winTitleText.setColor('#E65C5C');
      this.winSubtitleText.setText(`CPU wins!`);
      this.winSubtitleText.setColor('#E65C5C');
    }

    const statsLines = [
      `Score: ${stats.bottomScore} – ${stats.topScore}`,
      `Difficulty: ${diffLabel}`,
      `Longest Rally: ${stats.longestRally} hits`,
    ];
    this.winStatsText.setText(statsLines.join('\n'));

    // Save stats to localStorage
    this.persistStats(outcome, stats, difficulty);

    this.winPanel.setAlpha(1);
    this.winPanel.setScale(0.92);

    this.scene.tweens.add({
      targets: this.winPanel,
      scaleX: 1,
      scaleY: 1,
      duration: 250,
      ease: 'Back.Out',
    });
  }

  hideWinScreen() {
    this.winPanel.setAlpha(0);
    this.winPanel.setScale(0.96);
  }

  destroy() {
    this.scoreGlowText.destroy();
    this.scoreText.destroy();
    this.countdownText.destroy();
    this.pointText.destroy();
    this.messageText.destroy();
    this.winPanel.destroy();
    this.topNameLabel.destroy();
    this.bottomNameLabel.destroy();
    this.exitButtonContainer.destroy();
  }

  private persistStats(outcome: 'victory' | 'defeat', stats: MatchStats, difficulty: Difficulty) {
    try {
      const raw = localStorage.getItem('facepong-stats');
      const saved = raw ? JSON.parse(raw) : { wins: 0, losses: 0, matchesPlayed: 0, longestRally: 0, highestDifficultyBeaten: '' };

      saved.matchesPlayed += 1;
      if (outcome === 'victory') {
        saved.wins += 1;
        const order: Difficulty[] = ['easy', 'medium', 'hard', 'nightmare'];
        const currentIdx = order.indexOf(difficulty);
        const savedIdx = order.indexOf(saved.highestDifficultyBeaten);
        if (currentIdx > savedIdx) {
          saved.highestDifficultyBeaten = difficulty;
        }
      } else {
        saved.losses += 1;
      }
      if (stats.longestRally > saved.longestRally) {
        saved.longestRally = stats.longestRally;
      }

      localStorage.setItem('facepong-stats', JSON.stringify(saved));
    } catch {
      // localStorage not available — no-op
    }
  }

  private createNameLabel(name: string, color: number) {
    const label = this.scene.add.text(0, 0, name.toUpperCase(), {
      fontFamily: this.roundedFont,
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: '800',
    });
    label.setOrigin(0.5);
    label.setLetterSpacing(2);
    label.setShadow(0, 2, '#000000', 4, false, true);
    label.setAlpha(0.8);
    // Tint color isn't perfectly applied to text in the same way, but we can set the color string
    const hexColor = '#' + color.toString(16).padStart(6, '0');
    label.setColor(hexColor);
    
    return label;
  }
}