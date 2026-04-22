angular.module('ozilApp', [])
  .constant('API_BASE', 'https://api.ozil.cc')
  .controller('TrackerController', ['$http', 'API_BASE', function ($http, API_BASE) {
    var vm = this;

    var LABELS = { T: 'Pee', '2': 'Poop', D: 'Eat', Other: 'Other' };
    var ROW_CLASSES = { T: 'row-pee', '2': 'row-poop', D: 'row-eat', Other: 'row-other' };

    vm.entries = [];
    vm.displayEntries = [];
    vm.loading = false;
    vm.submitting = false;
    vm.error = null;
    vm.newEntry = {};

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function nowDate() {
      var d = new Date();
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function nowTime() {
      var d = new Date();
      return pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    function cutoffDate() {
      var d = new Date();
      d.setDate(d.getDate() - 3);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function updateDisplay() {
      var cutoff = cutoffDate();
      // String comparison works correctly for YYYY-MM-DD format
      vm.displayEntries = vm.entries.filter(function (e) { return e.date >= cutoff; });
    }

    function resetForm() {
      vm.newEntry = { date: nowDate(), time: nowTime(), activity: null, note: '' };
    }

    vm.label = function (code) { return LABELS[code] || code; };
    vm.rowClass = function (entry) { return ROW_CLASSES[entry.activity] || ''; };
    vm.isSelected = function (code) { return vm.newEntry.activity === code; };

    vm.setActivity = function (code) {
      vm.newEntry.activity = code;
      if (code !== 'Other') vm.newEntry.note = '';
      vm.error = null;
    };

    vm.canSubmit = function () {
      if (!vm.newEntry.activity) return false;
      if (vm.newEntry.activity === 'Other' && !vm.newEntry.note.trim()) return false;
      return true;
    };

    vm.load = function () {
      vm.loading = true;
      vm.error = null;
      $http.get(API_BASE + '/entries')
        .then(function (res) {
          // Sort newest-first by date+time string comparison
          vm.entries = res.data.sort(function (a, b) {
            return (b.date + b.time).localeCompare(a.date + a.time);
          });
          updateDisplay();
        })
        .catch(function () { vm.error = 'Failed to load entries.'; })
        .finally(function () { vm.loading = false; });
    };

    vm.submit = function () {
      if (!vm.canSubmit() || vm.submitting) return;
      vm.submitting = true;
      vm.error = null;
      $http.post(API_BASE + '/entries', vm.newEntry)
        .then(function (res) {
          vm.entries.unshift(res.data);
          updateDisplay();
          resetForm();
        })
        .catch(function () { vm.error = 'Failed to add entry. Try again.'; })
        .finally(function () { vm.submitting = false; });
    };

    vm.deleteEntry = function (entry) {
      entry.deleting = true;
      $http.delete(API_BASE + '/entries/' + entry.id)
        .then(function () {
          var idx = vm.entries.indexOf(entry);
          if (idx > -1) vm.entries.splice(idx, 1);
          updateDisplay();
        })
        .catch(function () {
          entry.deleting = false;
          vm.error = 'Failed to delete entry. Try again.';
        });
    };

    resetForm();
    vm.load();
  }]);
