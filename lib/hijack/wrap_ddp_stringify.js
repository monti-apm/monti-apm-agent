import { DDPCommon } from 'meteor/ddp-common';

export async function wrapStringifyDDP () {
  let originalStringifyDDP = DDPCommon.stringifyDDP;

  DDPCommon.stringifyDDP = function (msg) {
    let msgString = originalStringifyDDP(msg);
    let msgSize = Buffer.byteLength(msgString, 'utf8');

    let kadiraInfo = Kadira._getInfo();

    if (kadiraInfo?.trace?.type === 'method') {
      Kadira.models.methods.trackMsgSize(kadiraInfo.trace.name, msgSize);
    }

    if (Kadira.env?.currentSub) {
      if (msg?.msg === 'ready' && msg?.subs?.includes(Kadira.env.currentSub._subscriptionId)) {
        Kadira.env.currentSub._initialSentFinished = true;
        return msgString;
      }

      if (!Kadira.env.currentSub._initialSentFinished) {
        Kadira.models.pubsub.trackMsgSize(Kadira.env.currentSub._name, 'initialSent', msgSize);
        return msgString;
      }

      Kadira.models.pubsub.trackMsgSize(Kadira.env.currentSub._name, 'liveSent', msgSize);

      return msgString;
    }

    Kadira.models.methods.trackMsgSize('<not-a-method-or-a-pub>', msgSize);
    return msgString;
  };
}
