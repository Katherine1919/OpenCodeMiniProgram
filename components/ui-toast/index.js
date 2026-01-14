Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    message: {
      type: String,
      value: ''
    },
    duration: {
      type: Number,
      value: 2000
    }
  },

  observers: {
    'visible': function(newVal) {
      if (newVal) {
        setTimeout(() => {
          this.setData({ visible: false });
        }, this.properties.duration);
      }
    }
  }
})
