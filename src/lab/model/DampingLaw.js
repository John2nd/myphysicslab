// Copyright 2016 Erik Neumann.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

goog.provide('myphysicslab.lab.model.DampingLaw');

goog.require('goog.array');
goog.require('myphysicslab.lab.model.MassObject');
goog.require('myphysicslab.lab.model.CoordType');
goog.require('myphysicslab.lab.model.Force');
goog.require('myphysicslab.lab.model.ForceLaw');
goog.require('myphysicslab.lab.model.SimList');
goog.require('myphysicslab.lab.model.SimObject');
goog.require('myphysicslab.lab.util.AbstractSubject');
goog.require('myphysicslab.lab.util.Observer');
goog.require('myphysicslab.lab.util.ParameterNumber');
goog.require('myphysicslab.lab.util.Subject');
goog.require('myphysicslab.lab.util.Util');
goog.require('myphysicslab.lab.util.Vector');

goog.scope(function() {

var AbstractSubject = myphysicslab.lab.util.AbstractSubject;
var CoordType = myphysicslab.lab.model.CoordType;
var Force = myphysicslab.lab.model.Force;
var ForceLaw = myphysicslab.lab.model.ForceLaw;
var MassObject = myphysicslab.lab.model.MassObject;
var ParameterNumber = myphysicslab.lab.util.ParameterNumber;
var SimList = myphysicslab.lab.model.SimList;
var SimObject = myphysicslab.lab.model.SimObject;
const Util = goog.module.get('myphysicslab.lab.util.Util');
const Vector = goog.module.get('myphysicslab.lab.util.Vector');

/** Applies damping forces to a set of MassObjects. Damping is a friction force
like air resistance, or the surface friction of objects sliding on a table.

The set of objects can be specified with the {@link #addBody} method, or the DampingLaw
can observe a SimList and automatically add all bodies that have mass to the set of
objects.

The damping force slows both the translational velocity and rotational velocity of a
MassObject. The translational force is `(-k*vx, -k*vy)` where

+ `k` is the damping constant
+ `(vx, vy)` is the translational velocity of the body

The torque is `-k*rotateRatio*vw` where

+ `k` is the damping constant
+ `rotateRatio` is a constant used to calculate rotational damping
+ `vw` is the angular velocity of the body

The reason to have `rotateRatio` is so that it is easy to modify both translational and
rotational damping by adjusting only the damping constant.

Parameters Created
------------------

+ ParameterNumber named `DAMPING`, see {@link #setDamping}

+ ParameterNumber named `ROTATE_RATIO`, see {@link #setRotateRatio}


@param {number} damping translational damping factor
@param {number=} rotateRatio the ratio used to calculate rotational damping, as
    a fraction of translational damping
@param {!SimList=} opt_simList optional SimList to observe for
   when objects are added; also adds all existing bodies on that SimList.
@constructor
@final
@struct
@extends {AbstractSubject}
@implements {ForceLaw}
@implements {myphysicslab.lab.util.Observer}
*/
myphysicslab.lab.model.DampingLaw = function(damping, rotateRatio, opt_simList) {
  var id = DampingLaw.NAME_ID++;
  var nm = 'DAMPING_LAW' + (id > 0 ? '_'+id : '');
  AbstractSubject.call(this, nm);
  /**
  * @type {number}
  * @private
  */
  this.damping_ = damping;
  /** rotational damping is this fraction of damping
  * @type {number}
  * @private
  */
  this.rotateRatio_ = rotateRatio || 1.0;
  /**
  * @type {!Array<!MassObject>}
  * @private
  */
  this.bods_ = [];
  /**
  * @type {?SimList}
  * @private
  */
  this.simList_ = null;
  if (goog.isDefAndNotNull(opt_simList)) {
    this.connect(opt_simList);
  };
  this.addParameter(new ParameterNumber(this, DampingLaw.en.DAMPING,
      DampingLaw.i18n.DAMPING,
      goog.bind(this.getDamping, this), goog.bind(this.setDamping, this))
      .setSignifDigits(3));
  this.addParameter(new ParameterNumber(this, DampingLaw.en.ROTATE_RATIO,
      DampingLaw.i18n.ROTATE_RATIO,
      goog.bind(this.getRotateRatio, this), goog.bind(this.setRotateRatio, this))
      .setSignifDigits(3));
};
var DampingLaw = myphysicslab.lab.model.DampingLaw;
goog.inherits(DampingLaw, AbstractSubject);

if (!Util.ADVANCED) {
  /** @override */
  DampingLaw.prototype.toString = function() {
    return this.toStringShort().slice(0, -1)
        +', rotateRatio: '+Util.NF5(this.rotateRatio_)
        +', bodies: '+this.bods_.length
        + DampingLaw.superClass_.toString.call(this);
  };

  /** @override */
  DampingLaw.prototype.toStringShort = function() {
    return DampingLaw.superClass_.toStringShort.call(this).slice(0, -1)
        +', damping: '+Util.NF5(this.damping_)+'}';
  };
};

/** @override */
DampingLaw.prototype.getClassName = function() {
  return 'DampingLaw';
};
/**
* @type {number}
*/
DampingLaw.NAME_ID = 0;

/** Adds all the SimObjects to list of objects that DampingLaw applies forces to,
* but only those with mass.
* @param {!Array<!SimObject>} bodies set of SimObjects to
  possibly add
*/
DampingLaw.prototype.addBodies = function(bodies) {
  goog.array.forEach(bodies, goog.bind(this.addBody, this));
};

/** Adds the SimObject to list of objects that DampingLaw applies forces to, but only
* if it has positive finite mass.
* @param {!SimObject} obj the SimObject to possibly add
*/
DampingLaw.prototype.addBody = function(obj) {
  if (!obj.isMassObject() || goog.array.contains(this.bods_, obj)) {
    return;
  }
  var mobj = /** @type {!MassObject}*/(obj);
  var m = mobj.getMass();
  if (m > 0 && isFinite(m)) {
    this.bods_.push(mobj);
  }
};

/** @override */
DampingLaw.prototype.calculateForces = function() {
  /** @type {!Array<!Force>} */
  var forces = [];
  if (this.damping_ == 0) {
    return forces;
  }
  goog.array.forEach(this.bods_,
    function(bod) {
      if (!isFinite(bod.getMass())) // skip infinite mass objects
        return;
      // translational damping: location is center of mass;
      // direction/magnitude is  -k*body.vx, -k*body.vy
      var cm = bod.getPosition();
      var f = new Force('damping', bod,
          /*location=*/cm, CoordType.WORLD,
          /*direction=*/bod.getVelocity().multiply(-this.damping_), CoordType.WORLD,
          /*torque=*/-this.damping_*this.rotateRatio_* bod.getAngularVelocity());
      forces.push(f);
    }, this);
  return forces;
};

/** Connect to the given SimList, so that the force applies to all objects in the
SimList.
* @param {!SimList} simList  the SimList to connect with
*/
DampingLaw.prototype.connect = function(simList) {
  this.addBodies(simList.toArray());
  simList.addObserver(this);
  this.simList_ = simList;
};

/** @override */
DampingLaw.prototype.disconnect = function() {
  if (this.simList_ != null) {
    this.simList_.removeObserver(this);
  }
};

/** @override */
DampingLaw.prototype.getBodies = function() {
  return goog.array.clone(this.bods_);
};

/** Returns the strength of the damping force.
* @return {number} the strength of the damping force.
*/
DampingLaw.prototype.getDamping = function() {
  return this.damping_;
};

/** @override */
DampingLaw.prototype.getPotentialEnergy = function() {
  return 0;
};

/** Returns the ratio used to calculate rotational damping, as fraction of
translational damping.
* @return {number} ratio used to calculate rotational damping
*/
DampingLaw.prototype.getRotateRatio = function() {
  return this.rotateRatio_;
};

/** @override */
DampingLaw.prototype.observe =  function(event) {
  var obj;
  if (event.nameEquals(SimList.OBJECT_ADDED)) {
    obj = /** @type {!SimObject} */ (event.getValue());
    this.addBody(obj);
  } else if (event.nameEquals(SimList.OBJECT_REMOVED)) {
    obj = /** @type {!SimObject} */ (event.getValue());
    goog.array.remove(this.bods_, obj);
    goog.asserts.assert( !goog.array.contains(this.bods_, obj));
  }
};

/** Sets the strength of the damping force.
* @param {number} value strength of the damping force
*/
DampingLaw.prototype.setDamping = function(value) {
  this.damping_ = value;
  this.broadcastParameter(DampingLaw.en.DAMPING);
};

/** Sets the ratio used to calculate rotational damping, as fraction of translational
damping.
* @param {number} value ratio used to calculate rotational damping
*/
DampingLaw.prototype.setRotateRatio = function(value) {
  this.rotateRatio_ = value;
  this.broadcastParameter(DampingLaw.en.ROTATE_RATIO);
};

/** Set of internationalized strings.
@typedef {{
  DAMPING: string,
  ROTATE_RATIO: string
  }}
*/
DampingLaw.i18n_strings;

/**
@type {DampingLaw.i18n_strings}
*/
DampingLaw.en = {
  DAMPING: 'damping',
  ROTATE_RATIO: 'rotate ratio'
};

/**
@private
@type {DampingLaw.i18n_strings}
*/
DampingLaw.de_strings = {
  DAMPING: 'D\u00e4mpfung',
  ROTATE_RATIO: 'Drehquotient'
};

/** Set of internationalized strings.
@type {DampingLaw.i18n_strings}
*/
DampingLaw.i18n = goog.LOCALE === 'de' ? DampingLaw.de_strings :
    DampingLaw.en;

}); // goog.scope
