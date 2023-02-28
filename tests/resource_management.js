import { generateRandomString } from '../lib/string';
import { gzipDeflateObject, gzipObject } from '../lib/resource_management/compression';
import { runTestAsync } from './_helpers/helpers';
import sinon from 'sinon';
import { MemoryMonitor } from '../lib/resource_management/memory_monitor';

const getMockMemoryUsage = ({ heapTotal, heapUsed }) => ({
  rss: 100000000,
  heapUsed,
  heapTotal,
  external: 100000000,
  arrayBuffers: 100000000,
});

const samplePayload = {
  host: 'Leonardos-MacBook-Pro.local',
  clientVersions: {
    'web.cordova': 'none',
    'web.browser': '28d90cee936d3f9e8919bc3c25be2c49ebc71bac',
    'web.browser.legacy': 'none'
  },
  methodMetrics: [{
    methods: {
      'trace:spam:90': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 0: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 1
      },
      'trace:spam:91': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 35: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 1,
        db: 3,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 4
      },
      'trace:spam:92': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 0: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 1
      },
      'trace:spam:93': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:94': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 2,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 2
      },
      'trace:spam:95': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 28: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 2,
        total: 3
      },
      'trace:spam:96': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 1,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 2
      },
      'trace:spam:97': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 0: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 1
      },
      'trace:spam:98': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 1,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 2
      },
      'trace:spam:99': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 60,
        histogram: { alpha: 0.02, bins: { 35: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 1,
        db: 2,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 4
      },
      'trace:spam:100': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:1': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 28: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 2,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 3
      },
      'trace:spam:2': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 41: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 4,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 5
      }
    },
    startTime: 1677260692571
  }, {
    methods: {
      'trace:spam:3': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:4': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 28: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 2,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 3
      },
      'trace:spam:5': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:6': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:7': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 2,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 2
      },
      'trace:spam:8': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:9': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 0: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 1
      },
      'trace:spam:10': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 28: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 3,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 3
      },
      'trace:spam:11': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 1,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 2
      },
      'trace:spam:12': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 28: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 3,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 3
      },
      'trace:spam:13': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 0: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 1
      },
      'trace:spam:14': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 28: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 3,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 3
      },
      'trace:spam:15': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:16': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 35: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 2,
        http: 0,
        email: 0,
        async: 0,
        compute: 2,
        total: 4
      },
      'trace:spam:17': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 2,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 2
      },
      'trace:spam:18': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 2,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 2
      },
      'trace:spam:19': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 35: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 3,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 4
      },
      'trace:spam:20': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:21': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 18: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 1,
        total: 2
      },
      'trace:spam:22': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 28: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 3,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 3
      },
      'trace:spam:23': {
        count: 1,
        errors: 0,
        fetchedDocSize: 0,
        sentMsgSize: 62,
        histogram: { alpha: 0.02, bins: { 0: 1 }, maxNumBins: 2048, n: 1, gamma: 1.0408163265306123, numBins: 1 },
        wait: 0,
        db: 1,
        http: 0,
        email: 0,
        async: 0,
        compute: 0,
        total: 1
      }
    },
    startTime: 1677260700177
  }],
  methodRequests: [],
  pubMetrics: [],
  pubRequests: [],
  systemMetrics: [{
    startTime: 1677260692172,
    endTime: 1677260712174,
    sessions: 1,
    memory: 1200.984375,
    memoryArrayBuffers: 82.91327571868896,
    memoryExternal: 105.09693813323975,
    memoryHeapUsed: 802.7702789306641,
    memoryHeapTotal: 830.546875,
    newSessions: 0,
    activeRequests: 0,
    activeHandles: 17,
    pctEvloopBlock: 0.9692327397660252,
    evloopHistogram: {
      alpha: 0.02,
      bins: {
        100: 1,
        114: 1,
        120: 1,
        127: 2,
        130: 1,
        131: 1,
        135: 1,
        137: 2,
        146: 2,
        147: 1,
        148: 1,
        150: 2,
        151: 1,
        152: 1,
        154: 4,
        155: 1,
        158: 1,
        160: 1,
        161: 1,
        162: 1,
        163: 5,
        168: 3,
        169: 1,
        170: 3,
        171: 1,
        172: 1,
        173: 2,
        174: 1,
        175: 3,
        176: 3,
        178: 1,
        179: 1,
        180: 1,
        183: 1,
        187: 3,
        188: 1,
        189: 1,
        249: 1,
        257: 1,
        260: 1,
        261: 2,
        '-Infinity': 35
      },
      maxNumBins: 2048,
      n: 99,
      gamma: 1.0408163265306123,
      numBins: 42
    },
    gcMajorDuration: 32.765208,
    gcMinorDuration: 57.70083099999999,
    gcIncrementalDuration: 3.82712,
    gcWeakCBDuration: 0,
    mongoPoolSize: 100,
    mongoPoolPrimaryCheckouts: 34,
    mongoPoolOtherCheckouts: 0,
    mongoPoolCheckoutTime: 1,
    mongoPoolMaxCheckoutTime: 1,
    mongoPoolPending: 0,
    mongoPoolCheckedOutConnections: 0.15,
    mongoPoolCreatedConnections: 0,
    createdFibers: 0,
    activeFibers: 5.15,
    fiberPoolSize: 120,
    pcpu: 26.696063518210234,
    pcpuUser: 23.731228981357823,
    pcpuSystem: 0.1,
    cpuHistory: [{
      time: 1677260693984,
      usage: 0.29771668468682,
      sys: 0.001,
      user: 0.26768334584055736
    }, { time: 1677260695983, usage: 0.2945393003786695, sys: 0.001, user: 0.26375807242817034 }, {
      time: 1677260697983,
      usage: 0.30946589777769223,
      sys: 0.001,
      user: 0.27753839216687065
    }, {
      time: 1677260699983,
      usage: 0.24640639106539294,
      sys: 0.001,
      user: 0.21848633417578547
    }, { time: 1677260701984, usage: 0.33661789706054324, sys: 0.001, user: 0.2986771247412766 }, {
      time: 1677260703984,
      usage: 0.2903715248098452,
      sys: 0.001,
      user: 0.26154394023007876
    }, { time: 1677260705992, usage: 0.3267331361451392, sys: 0.001, user: 0.2929038564030138 }, {
      time: 1677260707993,
      usage: 0.25100266487945805,
      sys: 0.001,
      user: 0.22422552819430466
    }, {
      time: 1677260710029,
      usage: 0.2850540031089812,
      sys: 0.0009999999999999998,
      user: 0.2519852732783734
    }, { time: 1677260712028, usage: 0.26696063518210233, sys: 0.001, user: 0.23731228981357821 }]
  }],
  httpMetrics: [],
  httpRequests: [],
  errors: [{
    appId: 's4eSWPyZy4AgiHGmF',
    name: 'Something went wrong',
    type: 'server-internal',
    startTime: 1677260692572,
    subType: 'server',
    trace: {
      type: 'server-internal',
      subType: 'server',
      name: 'Something went wrong',
      errored: true,
      at: 1677260692572,
      events: [['start', 0, {
        userId: null,
        params: 'Monti APM: params are too big. First 4000 characters: [{"bigstring":"random::qs0e0xuzhflbnrf6xdonpp1u3k4kefc364pp1ofijcrjti29vmrzwf3po0mzl0h1n6xcg747o2i03of9jm9pcuyb017jhtod43seja976aoacai3z4eugvpfgyfamf6qhkun9jdv8vorexdbn8bayx5q3aflb1cr6y171tfjbnwgmvx51t80sagvbeq0rmr6nws9p54xba582ylk8x3rgocsek877u19ac8kwxbmwq1m8j3h9269mywli2c47avyux9fhev8cvfk2fuj26jgd374qyfduw0qba5trasev0yw49g7sjh7712pzacww6xt9bq7i34bvv7rfym2b78dsibk2baohvs0ycwmqg101zmzr4c0gxo5mii5oe8pxvgrx58y59ahm8fbfmjvk7ubentl07xxuo739bocqg3dns1vejzmevo5pq0eharnrcvcmdvba1jfreg3g565icxs7ivb75nsgmdtb8l5qf2t8kprsiqwstfadal7pbze2hmbg5wl3e87826rwhnjnzjewtb3y226wfkuyl1rx2h04hb40kiza9j1i68hvnh42xx5as5mqmb0xv66w2nnrkpo6qo1s6v80p7pwww1p48i3yxj02tm86oyy3hk57tb8fakz723pzvktlrpes0078kf7483ur1ez2mklxbps7qyvq45689v4zn365i5gduetiajs5im30ijeqium19na9gap862cgw47u8loimnari08xxk0rb2zzb82t1sp1xa5prhpnh5rewpll8nvrvs4zp4mj7w9l18g79jgal127svanowhsev781nq05ob4wcp7kvplj0pi5hfuiexln9vo6nnezkiwr7fdx1qaqj2ib9u22bcxk50tfftb2o5kzrvwpckpaho4njmiym8y8i01kl2jex0vc14t2lw6aw7bap1n2g3bue55869hiw08upn61yc39lpbwm7to8iou6mp2194attdd1rrobbt2lc3wkyhea8z1pwrkt6cipd05rwi2lfuzjq7um4un5742smp00egc9jjt8c5zsji4rgcfkwfbmo1rcms3yzrxhtbwmbn195hp12e7a51c4yi6tss01btbw3rzyc0eo19lu1gt3fqkwmj25pkalflqemk2i2s6uy9igywg0i6n65wrekza12gw4zfeqvgsjzlpjxtowh2mkppth5preybndq0pvyk5j8ukmqm2lttfmee5m6jfyt6imxaf2bi6sjwip1jztmsvya6x2tf521vbafwlyzvtd52lshp3rfc8mmw0oj5jfrxqpt12dzdih7aarwtglmprbkhyfoxfqzaybqnwmvmnvyc4rzsj64cpnx89lnnm4gffv25emwxmpsl7hpy19shdbatka0q5xktzou0kc79hmmoxjnengvcho2wg41ofr3a5m3fm12bhutpun4yjhuaqtvdls5lvpitkgs5l9d9je19ip91ghsrfm340fdlrfj57mg3cuab1ovecwy4wyle5ahcgon9sv830e48z3lpleaas6xkhg0zghcwpa23g9vgc3vrvglijs4vd22pdnfys36y77flpi6uyv0hsm7li3fz9qkyt49wjcxpcqys2f89zga4w1fta12hsdby46h87n9bqbq46f3w5sxyjon4smf57fzaidv48xutjce7mbdu6hndozej2jxwoetqw61cw3cokc8luswv0z551xi27n6njyus2b5nss258uhn6ohgj5hpn7znb8beopvhbkcbuhja2aebuzrhrmh5mmgb1mhprqqnkheug1eabcn33zcc97zxt0t0wj35kybdbe9buvg6dotjydhxz72cybtgz3vnrzmyyjssrxa8f4rg6c9g1opaz90jca8cxj0s1v9azq5gvy86z75yznb74h2fo1711d1ynkx2ccjacraqn82od0y8zvxk98iqmd8j98r7lj75ue2eturuenvbh8a6hwr4syzufc73f9w1tuhpbox4fiyjk0zjr453gi5dst9rtsjtjquockeew919kj93uynogd6r9hqj1ngfy9wrf883u7iam5uvcle1hnlbzt5kir543ljyxfpi33weim1x5obwbrwhm214p6d8hq9fvi5osid59mx8noi12t10bwn5gpzelgpe8hoz6beqy5zgw83enznzmis46a1z5i29drjrr2u37kz6j17z4nuy6co1dbyot8ko2iqw8ucb7i5xi2bu0pkmzjhi81rm0p22ncm0gx821alm38vrch3pliq446egbxh370c4en7eb9km1nd5fik4cww8hfs4f73jbhhplhajs33w809t7pegpxfqxk7l15a5f1k80d2dcbuq0h7mpgjmmrrsnwlcm4ymuroxzibmy87081htkdgrlphw02y8rhx6kwyaqmic5h25na5lav7vpfbztfd6xu7wexorcqhe4ycjkcc8m2emxwbyrerk7z5mopaftjemng4l3otybyn6y849hag9z34zcfuvf8ajlkgvol8cf8z3g2k5ir94d62ynh63z89w8o79j87of6imgj4q1tkyu3y93a6onjsciz9o262aso5c7s1gtbdwav8bdla6d08uqjof41j63capqj9w0cjqzbkdp3bsmun7j65k144phfmhv92vnr4ba1ya3saddkj7vbxjb79fyzuhnmabt4b1tbgcr2d6df8n3iklh5ej99f85dgbe43e9s80dtc3xdzfrtexyv7zg06tyctmtatyayfa7m0tdkuivqk92mqklwb4tykt8udtqi1l58lt8l32xbz0eep3jtpkofarbzlrhv5bfj93p2cnvqjiqt1s9o4xrohu04d09ehqgz0ma1ksugui7sae6s8fs512ruo35osmm1ps1z6etf3wb2yi2xbgecfvxjq7m4a1cx6rbyq0xua91k1bj21hkvccn4s2m8xpt0j6829tb5xhbj8eeisosxmb5prhq1kdvfxmfchlw0hw4rn5iec2by2mxbhf6sovqryh27crw4gmiqocy22i98pvee8gx35hkp9913mds4t7wx02daqyv5xdos0pcewnstjqf8odyit7l3yjwen2rd6v4idjklrpw7csvj79zuk4fmdgw3n9ybig5m6raywl67l3t49815b9vot00ei0uw40z91we0reeg4g4mq7klzs70q0rc81xbzob8gnuohpb9cghygpxwijj9pko6ywo9zq7jzguqacw60xhm67c84c100u0ogy2e6caub2wbu0gwescf6j85kgdvcahnbpbwiaxwjz5bfec932vfiaisearoxi1uibsgbl0620vxd8ttq2gor96f0e9o661lktudmued1vqgne5c26euzg0vayqpog301gznqlvov13arloapx63dt8rbd2oq8j2oyeqottiavynp238npstfme6w5nq70s5pb8qu4bj7o3allej8e238irc8z4tau130zrfwhujnh05kis9x92582e2i509bhfwp8dv7xji491d3zxqmn72sxpv89w4wr455w1bcz5zy6m4q3oimkefyysg50i9ls6ghfqcaaypz2g3yguljzp1hbkop17yujty0xij3tby8hftq9ybllkq4gq1hjy6w26kzyqfepjhi4eubhu43pux3qhocld2xiwf4u3mrxbd9cbqf3yd6umc67hl03po56sdts19y7n5zaa7z1x3p49vc33y0cxnfdjgsea6oevymp8nzx0zq1has1jxcqufbikdpgkvqpe02d4eeo9kzfa7cmz7x1tzcngk9ay2w59yoicknz0uylki5vf9a4pew1hqumk5ion4088wbsqavafht75i6tjcio7f31c8u9olyceczskyc3jxr24cjm70eyspnsj5l8j45zhjqh1yu66z9bfc9belvknesc7x3lzenez8g9d5k0zs4vrsoxbhuf283s8w1'
      }], ['wait', 0, { waitOn: [] }], ['db', 0, {
        coll: 'links',
        func: 'find',
        selector: '{}'
      }], ['db', 1, {
        coll: 'links',
        selector: '{}',
        func: 'count',
        cursor: true
      }], ['error', 0, {
        error: {
          message: 'Something went wrong',
          stack: 'Error: Something went wrong\n    at MethodInvocation.trace:spam:90 (imports/methods/performance.js:54:24)\n    at MethodInvocation.methodMap.<computed> (packages/montiapm:agent/lib/hijack/wrap_session.js:190:30)\n    at maybeAuditArgumentChecks (packages/ddp-server/livedata_server.js:1902:12)\n    at getCurrentMethodInvocationResult (packages/ddp-server/livedata_server.js:772:38)\n    at Meteor.EnvironmentVariable.EVp.withValue (packages/meteor.js:1329:12)\n    at packages/ddp-server/livedata_server.js:791:46\n    at new Promise (<anonymous>)\n    at Session.method (packages/ddp-server/livedata_server.js:739:23)\n    at packages/montiapm:agent/lib/hijack/wrap_session.js:71:38\n    at Meteor.EnvironmentVariable.EVp.withValue (packages/meteor.js:1329:12)\n    at Session.sessionProto.protocol_handlers.method (packages/montiapm:agent/lib/hijack/wrap_session.js:70:40)\n    at packages/ddp-server/livedata_server.js:603:43'
        }
      }]],
      metrics: { total: 0 }
    },
    stacks: [{ stack: 'Error: Something went wrong\n    at MethodInvocation.trace:spam:90 (imports/methods/performance.js:54:24)\n    at MethodInvocation.methodMap.<computed> (packages/montiapm:agent/lib/hijack/wrap_session.js:190:30)\n    at maybeAuditArgumentChecks (packages/ddp-server/livedata_server.js:1902:12)\n    at getCurrentMethodInvocationResult (packages/ddp-server/livedata_server.js:772:38)\n    at Meteor.EnvironmentVariable.EVp.withValue (packages/meteor.js:1329:12)\n    at packages/ddp-server/livedata_server.js:791:46\n    at new Promise (<anonymous>)\n    at Session.method (packages/ddp-server/livedata_server.js:739:23)\n    at packages/montiapm:agent/lib/hijack/wrap_session.js:71:38\n    at Meteor.EnvironmentVariable.EVp.withValue (packages/meteor.js:1329:12)\n    at Session.sessionProto.protocol_handlers.method (packages/montiapm:agent/lib/hijack/wrap_session.js:70:40)\n    at packages/ddp-server/livedata_server.js:603:43' }],
    count: 34
  }],
  bloat: generateRandomString(1024 * 1024 * 12)
};

Tinytest.add(
  'Resource Management - Compression',
  runTestAsync(async function (test) {
    console.time('gzipObject');
    const compressed = await gzipObject(samplePayload);
    console.timeEnd('gzipObject');

    console.log(compressed.constructor.name);
    test.equal(compressed.constructor.name, 'Buffer');

    console.time('gzipDeflateObject');
    const decompressed = await gzipDeflateObject(compressed);
    console.timeEnd('gzipDeflateObject');

    test.equal(typeof decompressed, 'object');
    test.equal(typeof decompressed.bloat, 'string');
  })
);

Tinytest.add(
  'Resource Management - Memory Monitor',
  runTestAsync(async function (test) {
    const heapTotal = 100000000;

    const muref = getMockMemoryUsage({ heapTotal, heapUsed: heapTotal - MemoryMonitor.CRITICAL_MEMORY_THRESHOLD + 1 });

    const stub = sinon.stub(process, 'memoryUsage').returns(muref);

    const monitor = new MemoryMonitor(100);

    const critical = await new Promise(resolve => monitor.onMemoryCritical(resolve));

    test.equal(critical.heapUsed, heapTotal - MemoryMonitor.CRITICAL_MEMORY_THRESHOLD + 1);

    muref.heapUsed = heapTotal - MemoryMonitor.HIGH_MEMORY_THRESHOLD + 1;

    const high = await new Promise(resolve => monitor.onMemoryHigh(resolve));

    test.equal(high.heapUsed, heapTotal - MemoryMonitor.HIGH_MEMORY_THRESHOLD + 1);

    muref.heapUsed = 30000000;

    const tick = await new Promise(resolve => monitor.on('tick', resolve));

    test.equal(tick.heapUsed, 30000000);

    stub.restore();
    monitor.destroy();
  })
);
