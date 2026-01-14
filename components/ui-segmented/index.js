Component({
  properties: {
    options: {
      type: Array,
      value: []
    },
    selected: {
      type: Number,
      value: 0
    }
  },

  methods: {
    onSelect(e) {
      const index = e.currentTarget.dataset.index;
      this.setData({ selected: index });
      this.triggerEvent('change', { index });
    }
  }
})
