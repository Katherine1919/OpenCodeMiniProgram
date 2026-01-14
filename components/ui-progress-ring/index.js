Component({
  properties: {
    progress: {
      type: Number,
      value: 0
    },
    size: {
      type: Number,
      value: 200
    },
    strokeWidth: {
      type: Number,
      value: 12
    }
  },

  data: {
    ctx: null
  },

  observers: {
    'progress, size, strokeWidth': function() {
      this.drawRing();
    }
  },

  lifetimes: {
    attached() {
      this.drawRing();
    }
  },

  methods: {
    drawRing() {
      const { progress, size, strokeWidth } = this.properties;
      const ctx = wx.createCanvasContext('progress-ring', this);
      const centerX = size / 2;
      const centerY = size / 2;
      const radius = (size - strokeWidth) / 2;

      ctx.clearRect(0, 0, size, size);
      ctx.setLineWidth(strokeWidth);
      ctx.setLineCap('round');

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.setStrokeStyle('rgba(31, 26, 22, 0.08)');
      ctx.stroke();

      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (progress / 100) * 2 * Math.PI;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, endAngle);
      ctx.setStrokeStyle('#F7C86A');
      ctx.stroke();

      ctx.draw();
    }
  }
})
