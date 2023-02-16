export async function subscribe(name, params) {
  return new Promise((resolve, reject) => {
    const subscription = Meteor.subscribe(name, params, {
      onReady: () => {
        resolve(subscription);
      },
      onError: (error) => {
        reject(error);
      },
    });
  });
}
