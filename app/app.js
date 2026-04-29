angular.module('ozilApp', [])
  .constant('API_BASE', 'https://api.ozil.cc')
  .controller('TrackerController', ['$http', '$q', 'API_BASE', function ($http, $q, API_BASE) {
    var vm = this;

    var LABELS = { T: 'Pee', '2': 'Poop', D: 'Eat', Other: 'Other' };
    var ROW_CLASSES = { T: 'row-pee', '2': 'row-poop', D: 'row-eat', Other: 'row-other' };
    var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];

    vm.entries = [];
    vm.displayGroups = [];
    vm.loading = false;
    vm.submitting = false;
    vm.error = null;
    vm.newEntry = {};

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function parseEntryDate(entry) {
      var p = entry.date.split('-'), tp = entry.time.split(':');
      return new Date(+p[0], +p[1] - 1, +p[2], +tp[0], +tp[1]);
    }

    vm.timeSince = function (code) {
      for (var i = 0; i < vm.entries.length; i++) {
        if (vm.entries[i].activity === code) {
          var mins = Math.floor((new Date() - parseEntryDate(vm.entries[i])) / 60000);
          if (mins < 60) return mins + 'm ago';
          var h = Math.floor(mins / 60), m = mins % 60;
          return m > 0 ? h + 'h ' + m + 'm ago' : h + 'h ago';
        }
      }
      return null;
    };

    vm.timeSinceClass = function (code) {
      for (var i = 0; i < vm.entries.length; i++) {
        if (vm.entries[i].activity === code) {
          var mins = Math.floor((new Date() - parseEntryDate(vm.entries[i])) / 60000);
          return mins < 120 ? 'time-recent' : 'time-old';
        }
      }
      return '';
    };

    function dateStr(d) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }

    function cutoffDate() {
      var d = new Date();
      d.setDate(d.getDate() - 3);
      return dateStr(d);
    }

    function groupByDate(entries) {
      var groups = [];
      var map = {};
      entries.forEach(function (e) {
        if (!map[e.date]) {
          map[e.date] = { date: e.date, entries: [] };
          groups.push(map[e.date]);
        }
        map[e.date].entries.push(e);
      });
      return groups;
    }

    function updateDisplay() {
      var cutoff = cutoffDate();
      var filtered = vm.entries.filter(function (e) { return e.date >= cutoff; });
      vm.displayGroups = groupByDate(filtered);
    }

    function resetForm() {
      vm.newEntry = { customTime: false, dateObj: null, timeObj: null, activities: [], note: '' };
    }

    vm.toggleCustomTime = function () {
      vm.newEntry.customTime = !vm.newEntry.customTime;
      if (vm.newEntry.customTime) {
        // Pre-fill with current time when the user opens the picker
        var now = new Date();
        vm.newEntry.dateObj = now;
        vm.newEntry.timeObj = now;
      }
    };

    vm.label = function (code) { return LABELS[code] || code; };
    vm.rowClass = function (entry) { return ROW_CLASSES[entry.activity] || ''; };
    vm.isSelected = function (code) { return vm.newEntry.activities.indexOf(code) > -1; };

    vm.formatDate = function (ds) {
      var today = new Date();
      if (ds === dateStr(today)) return 'Today';
      var yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (ds === dateStr(yesterday)) return 'Yesterday';
      // Parse without timezone shift by constructing from parts
      var p = ds.split('-');
      var d = new Date(+p[0], +p[1] - 1, +p[2]);
      return DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
    };

    vm.toggleActivity = function (code) {
      var idx = vm.newEntry.activities.indexOf(code);
      if (idx > -1) {
        vm.newEntry.activities.splice(idx, 1);
        if (code === 'Other') vm.newEntry.note = '';
      } else {
        vm.newEntry.activities.push(code);
      }
      vm.error = null;
    };

    vm.canSubmit = function () {
      if (vm.newEntry.activities.length === 0) return false;
      if (vm.isSelected('Other') && !vm.newEntry.note.trim()) return false;
      return true;
    };

    vm.load = function () {
      vm.loading = true;
      vm.error = null;
      $http.get(API_BASE + '/entries')
        .then(function (res) {
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

      // Use current time at moment of submit unless the user set a custom time
      var now = new Date();
      var d = (vm.newEntry.customTime && vm.newEntry.dateObj) ? vm.newEntry.dateObj : now;
      var t = (vm.newEntry.customTime && vm.newEntry.timeObj) ? vm.newEntry.timeObj : now;
      var date = dateStr(d);
      var time = pad(t.getHours()) + ':' + pad(t.getMinutes());
      var note = vm.newEntry.note || '';

      var promises = vm.newEntry.activities.map(function (activity) {
        return $http.post(API_BASE + '/entries', {
          date: date, time: time, activity: activity,
          note: activity === 'Other' ? note : ''
        });
      });

      $q.all(promises)
        .then(function (responses) {
          responses.forEach(function (res) { vm.entries.unshift(res.data); });
          vm.entries.sort(function (a, b) {
            return (b.date + b.time).localeCompare(a.date + a.time);
          });
          updateDisplay();
          resetForm();
        })
        .catch(function () { vm.error = 'Failed to add entries. Try again.'; })
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
