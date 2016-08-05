var Referee={
    ourDetectedUnits:[],//Detected enemies
    enemyDetectedUnits:[],//Detected ours
    _pos:[[-1,0],[1,0],[0,-1],[0,1]],//Collision avoid
    tasks:['judgeArbiter','judgeDetect','judgeRecover','judgeDying','judgeMan',
        'addLarva','coverFog','alterSelectionMode','judgeBuildingInjury','judgeWinLose','saveReplaySnapshot'],
    voice:{
        pError:new Audio('bgm/PointError.wav'),
        button:new Audio('bgm/Button.wav'),
        resource:{
            Zerg:{
                mine:new Audio('bgm/mine.Zerg.wav'),
                gas:new Audio('bgm/gas.Zerg.wav'),
                man:new Audio('bgm/man.Zerg.wav'),
                magic:new Audio('bgm/magic.Zerg.wav')
            },
            Terran:{
                mine:new Audio('bgm/mine.Terran.wav'),
                gas:new Audio('bgm/gas.Terran.wav'),
                man:new Audio('bgm/man.Terran.wav'),
                magic:new Audio('bgm/magic.Terran.wav')
            },
            Protoss:{
                mine:new Audio('bgm/mine.Protoss.wav'),
                gas:new Audio('bgm/gas.Protoss.wav'),
                man:new Audio('bgm/man.Protoss.wav'),
                magic:new Audio('bgm/magic.Protoss.wav')
            }
        },
        upgrade:{
            Zerg:new Audio('bgm/upgrade.Zerg.wav'),
            Terran:new Audio('bgm/upgrade.Terran.wav'),
            Protoss:new Audio('bgm/upgrade.Protoss.wav')
        }
    },
    winCondition:function(){
        //By default: All our units and buildings are killed
        return (Unit.allEnemyUnits().length==0 && Building.enemyBuildings().length==0);
    },
    loseCondition:function(){
        //By default: All enemies and buildings are killed
        return (Unit.allOurUnits().length==0 && Building.ourBuildings().length==0);
    },
    judgeArbiter:function(){
        //Every 0.4 sec
        if (Game.mainTick%4==0){
            //Special skill: make nearby units invisible
            let arbiterBuffer=Protoss.Arbiter.prototype.bufferObj;
            let allArbiters=Game.getPropArray([]);
            Unit.allUnits.forEach(chara=>{
                if (chara.name=='Arbiter') allArbiters[chara.team].push(chara);
            });
            //Clear old units' Arbiter buffer and clear sets
            Referee.underArbiterUnits.forEach(function(charaSets){
                for (let chara of charaSets){
                    chara.removeBuffer(arbiterBuffer);
                }
                charaSets.clear();
            });
            allArbiters.forEach(function(arbiters,N){
                //Find new under arbiter units
                arbiters.forEach(function(arbiter){
                    //Find targets: same team units inside Arbiter sight, exclude Arbiter
                    let targets=Game.getInRangeOnes(arbiter.posX(),arbiter.posY(),arbiter.get('sight'),N,
                        true,null,chara=>(arbiters.indexOf(chara)==-1));
                    targets.forEach(function(target){
                        Referee.underArbiterUnits[N].add(target);
                    });
                });
            });
            //Arbiter buffer effect on these units
            Referee.underArbiterUnits.forEach(function(charaSets){
                for (let chara of charaSets){
                    chara.addBuffer(arbiterBuffer);
                }
            });
        }
    },
    //detectorBuffer are reverse of arbiterBuffer
    judgeDetect:function(){
        //Every 0.4 sec
        if (Game.mainTick%4==0){
            //Same detector buffer reference
            let detectorBuffer=Gobj.detectorBuffer;
            let allDetectors=Game.getPropArray([]);
            Unit.allUnits.forEach(chara=>{
                if (chara.detector) allDetectors[chara.team].push(chara);
            });
            //Clear old units detected buffer and clear old sets
            Referee.detectedUnits.forEach(function(charaSets,team){
                //For each team
                for (let chara of charaSets){
                    chara.removeBuffer(detectorBuffer[team]);
                }
                charaSets.clear();
            });
            allDetectors.forEach(function(detectors,N){
                //Find new under detector units
                detectors.forEach(function(detector){
                    //Find targets: enemy invisible units inside detector sight
                    let targets=Game.getInRangeOnes(detector.posX(),detector.posY(),detector.get('sight'),
                        N+'',true,null,chara=>(chara[`isInvisible${Game.team}`]));
                    targets.forEach(function(target){
                        Referee.detectedUnits[N].add(target);
                    });
                });
            });
            //Detector buffer effect on these units
            Referee.detectedUnits.forEach(function(charaSets,team){
                //For each team
                for (let chara of charaSets){
                    chara.addBuffer(detectorBuffer[team]);
                }
            });
            //PurpleEffect, RedEffect and GreenEffect are also detector, override invisible
            Animation.allEffects.filter(function(effect){
                return (effect instanceof Animation.PurpleEffect) ||
                    (effect instanceof Animation.RedEffect) ||
                    (effect instanceof Animation.GreenEffect)
            }).forEach(function(effect){
                let target=effect.target;
                for (let team=0;team<Game.playerNum;team++){
                    //Make already invisible units to visible by all teams
                    if (target[`isInvisible${team}`]) target[`isInvisible${team}`]=false;
                }
            });
        }
    },
    judgeReachDestination:function(chara){
        //Idle but has destination
        if (chara.destination && chara.isIdle()) {
            //Already here
            if (chara.insideSquare({centerX:chara.destination.x,centerY:chara.destination.y,radius:Unit.moveRange})) {
                //Has next destination
                if (chara.destination.next) {
                    chara.destination=chara.destination.next;
                    chara.moveTo(chara.destination.x,chara.destination.y);
                    chara.targetLock=false;
                }
                //No more destination
                else {
                    delete chara.destination;
                }
            }
            //Continue moving
            else {
                chara.moveTo(chara.destination.x,chara.destination.y);
                chara.targetLock=false;
            }
        }
    },
    judgeRecover:function(){
        //Every 1 sec
        if (Game.mainTick%10==0){
            [...Unit.allUnits,...Building.allBuildings].forEach(chara=>{
                if (chara.recover) chara.recover();
            });
        }
    },
    judgeDying:function(){
        //Kill die survivor every 1 sec
        if (Game.mainTick%10==0){
            [...Unit.allUnits,...Building.allBuildings].filter(chara=>{
                return chara.life<=0 && chara.status!='dead';
            }).forEach(chara=>{
                chara.die();
            });
        }
    },
    //Avoid collision
    judgeCollision:function(){
        //N*N->N
        let units=[...Unit.allGroundUnits(),...Building.allBuildings];
        for(let N=0;N<units.length;N++) {
            let chara1 = units[N];
            for(let M=N+1;M<units.length;M++) {
                let chara2 = units[M];
                let dist=chara1.distanceFrom(chara2);
                //Ground unit collision limit
                let distLimit;
                if (chara2 instanceof Unit){
                    distLimit=(chara1.radius()+chara2.radius())*0.5;
                    if (distLimit<Unit.meleeRange) distLimit=Unit.meleeRange;//Math.max
                }
                //Collision with Building
                else{
                    distLimit=(chara1.radius()+chara2.radius())*0.8;
                }
                //Separate override ones
                if (dist==0) {
                    let colPos=Referee._pos[Game.getNextRandom()*4>>0];
                    if (chara1 instanceof Unit){
                        chara1.x+=colPos[0];
                        chara1.y+=colPos[1];
                        dist=1;
                    }
                    else {
                        if (chara2 instanceof Unit){
                            chara2.x+=colPos[0];
                            chara2.y+=colPos[1];
                            dist=1;
                        }
                    }
                }
                if (dist<distLimit) {
                    //Collision flag
                    chara1.collision=chara2;
                    chara2.collision=chara1;
                    //Adjust ratio
                    let K=(distLimit-dist)/dist/2;
                    let adjustX=K*(chara1.x-chara2.x)>>0;
                    let adjustY=K*(chara1.y-chara2.y)>>0;
                    //Adjust location
                    let [interactRatio1,interactRatio2]=[0,0];
                    if (chara1 instanceof Building){
                        interactRatio1=0;
                        //Building VS Unit
                        if (chara2 instanceof Unit) interactRatio2=2;
                        //Building VS Building
                        else interactRatio2=0;
                    }
                    else {
                        //Unit VS Unit
                        if (chara2 instanceof Unit) {
                            if (chara1.status=="moving"){
                                //Move VS Move
                                if (chara2.status=="moving"){
                                    interactRatio1=1;
                                    interactRatio2=1;
                                }
                                //Move VS Dock
                                else {
                                    interactRatio1=2;
                                    interactRatio2=0;
                                }
                            }
                            else {
                                //Dock VS Move
                                if (chara2.status=="moving"){
                                    interactRatio1=0;
                                    interactRatio2=2;
                                }
                                //Dock VS Dock
                                else {
                                    interactRatio1=1;
                                    interactRatio2=1;
                                }
                            }
                        }
                        //Unit VS Building
                        else {
                            interactRatio1=2;
                            interactRatio2=0;
                        }
                    }
                    chara1.x+=interactRatio1*adjustX;
                    chara1.y+=interactRatio1*adjustY;
                    chara2.x-=interactRatio2*adjustX;
                    chara2.y-=interactRatio2*adjustY;
                }
            }
        }
        units=Unit.allFlyingUnits();
        for(let N=0;N<units.length;N++) {
            let chara1 = units[N];
            for(let M=N+1;M<units.length;M++) {
                let chara2 = units[M];
                let dist=chara1.distanceFrom(chara2);
                //Flying unit collision limit
                let distLimit=Unit.meleeRange;
                //Separate override ones
                if (dist==0) {
                    let colPos=Referee._pos[Game.getNextRandom()*4>>0];
                    chara1.x+=colPos[0];
                    chara1.y+=colPos[1];
                    dist=1;
                }
                if (dist<distLimit) {
                    //Adjust ratio
                    let K=(distLimit-dist)/dist/2;
                    let adjustX=K*(chara1.x-chara2.x)>>0;
                    let adjustY=K*(chara1.y-chara2.y)>>0;
                    //Adjust location
                    chara1.x+=adjustX;
                    chara1.y+=adjustY;
                    chara2.x-=adjustX;
                    chara2.y-=adjustY;
                }
            }
        }
    },
    coverFog:function(){
        //No need to set interval as 1sec
        if (Game.mainTick%10==0) Map.drawFogAndMinimap();
    },
    alterSelectionMode:function(){
        //GC after some user changes
        $.extend([],Game.allSelected).forEach(chara=>{
            if (chara.status=='dead' || (chara[`isInvisible${Game.team}`] && chara.isEnemy()))
                Game.allSelected.splice(Game.allSelected.indexOf(chara),1);
        });
        //Alter info UI: Multi selection mode
        if (Game.allSelected.length>1){
            //Need minor refresh or big move
            if (_$.arrayEqual(Game.allSelected,Game._oldAllSelected)){
                //Only refresh
                Game.refreshMultiSelectBox();
            }
            else {
                //Redraw multiSelection div
                Game.drawMultiSelectBox();
                //Record this operation
                Game._oldAllSelected=_$.mixin([],Game.allSelected);
            }
            //Show multiSelection box
            $('div.override').show();
            $('div.override div.multiSelection').show();
        }
        //Alter info UI: Single selection mode
        else {
            $('div.override').hide();
            $('div.override div.multiSelection').hide();
        }
    },
    addLarva:function(){
        //Every 20 sec
        if (Game.mainTick%200==0){
            Building.allBuildings.filter(function(build){
                return build.produceLarva;
            }).forEach(function(build){
                //Can give birth to 3 larvas
                for(let N=0;N<3;N++){
                    if (build.larvas[N]==null || build.larvas[N].status=="dead"){
                        build.larvas[N]=new Zerg.Larva({x:(build.x+N*48),y:(build.y+build.height),team:build.team});
                        //Which base larva belongs to
                        build.larvas[N].owner=build;
                        break;
                    }
                }
            });
        }
    },
    judgeBuildingInjury:function(){
        //Every 1 sec
        if (Game.mainTick%10==0){
            Building.allBuildings.filter(function(build){
                return build.injuryOffsets;
            }).forEach(function(build){
                let injuryLevel=(1-build.life/build.HP)/0.25>>0;
                if (injuryLevel>3) injuryLevel=3;
                let curLevel=build.injuryAnimations.length;
                if (injuryLevel>curLevel){
                    let offsets=build.injuryOffsets;
                    let scale=build.injuryScale?build.injuryScale:1;
                    for (let N=curLevel;N<injuryLevel;N++){
                        //Add injury animations
                        build.injuryAnimations.push(new Animation[build.injuryNames[N]]({target:build,offset:offsets[N],scale:scale}));
                    }
                    if ((build instanceof Building.TerranBuilding) || (build instanceof Building.ProtossBuilding)){
                        if (injuryLevel>1) build.sound.selected=build.sound.onfire;
                    }
                }
                if (injuryLevel<curLevel){
                    for (let N=curLevel;N>injuryLevel;N--){
                        //Clear injury animations
                        build.injuryAnimations.pop().die();
                    }
                    if ((build instanceof Building.TerranBuilding) || (build instanceof Building.ProtossBuilding)){
                        if (injuryLevel<=1) build.sound.selected=build.sound.normal;
                    }
                }
            });
        }
    },
    judgeMan:function(){
        //Update current man and total man for all teams
        //?We may only need to judge our team's man for client consume use
        let curMan=Game.getPropArray(0),totalMan=Game.getPropArray(0);
        [...Unit.allUnits,...Building.allBuildings].forEach(chara=>{
            if (chara.cost && chara.cost.man) (curMan[chara.team])+=chara.cost.man;
            if (chara.manPlus) (totalMan[chara.team])+=chara.manPlus;
            //Transport
            if (chara.loadedUnits) {
                chara.loadedUnits.forEach(function(passenger){
                    if (passenger.cost && passenger.cost.man) (curMan[passenger.team])+=passenger.cost.man;
                });
            }
        });
        for (let N=0;N<Game.playerNum;N++){
            Resource[N].curMan=curMan[N];
            Resource[N].totalMan=totalMan[N];
        }
    },
    judgeWinLose:function(){
        //Every 1 sec
        if (Game.mainTick%10==0){
            if (Referee.loseCondition())
                Game.lose();
            if (Referee.winCondition())
                Game.win();
        }
    },
    saveReplaySnapshot:function(){
        //Save replay snapshot every 3 sec
        if (Game.mainTick%30==0){
            Game.saveReplay();
        }
    }
};