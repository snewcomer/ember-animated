import { rAF } from './concurrency-helpers';
import parallel from './parallel';


export default class TransitionContext {
  constructor(duration, insertedSprites, keptSprites, removedSprites, farMatches, removalMotions) {
    this.duration = duration;
    this._generators = [];
    this.insertedSprites = insertedSprites;
    this.keptSprites = keptSprites;
    this.removedSprites = removedSprites;
    this._farMatches = farMatches;
    this._removalMotions = removalMotions;
  }
  matchFor(sprite) {
    return this._farMatches.get(sprite);
  }
  get insertedSprite() {
    return this.insertedSprites[0];
  }
  get removedSprite() {
    return this.removedSprites[0];
  }
  run(MotionClass, sprite, opts) {
    if (!opts) {
      opts = { duration: this.duration }
    } else {
      if (opts.duration == null) {
        opts = Object.assign({}, opts);
        opts.duration = this.duration;
      }
    }
    let motion = new MotionClass(sprite, opts);
    let generator = this._runMotion(motion);
    this._generators.push(generator);
    return motion._promise;
  }
  _runMotion(motion) {
    if (this.removedSprites.indexOf(motion.sprite) !== -1) {
      return this._runWithRemoval(motion);
    }
    if (this.insertedSprites.indexOf(motion.sprite) !== -1) {
      motion.sprite.reveal();
    }
    return motion.run();
  }
  * _runWithRemoval(motion) {
    let motionCounts = this._removalMotions;
    let count = motionCounts.get(motion.sprite) || 0;
    if (count === 0) {
      motion.sprite.append();
      motion.sprite.lock();
    }
    count++;
    motionCounts.set(motion.sprite, count);
    try {
      yield * motion.run();
    } finally {
      rAF().then(() => {
        let count = motionCounts.get(motion.sprite);
        if (count > 1) {
          motionCounts.set(motion.sprite, --count);
        } else {
          motion.sprite.remove();
          motionCounts.delete(motion.sprite)
        }
      });
    }
  }
  * _runToCompletion() {
    yield * parallel(this._generators, onError)
  }
}

function onError(reason) {
  if (reason.name !== 'TaskCancelation') {
    setTimeout(function() {
      throw reason;
    }, 0);
  }
}
