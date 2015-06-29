/**
 * spa.model.js
 * Model module for SPA
*/

/*jslint    browser : true, continue: true,
  devel : true, indent : 2, maxerr : 50,
  newcap : true, nomen : true, plusplus : true,
  regexp : true, sloppy : true, vars : false,
  white : true
*/
/*global TAFFY, $, spa */

spa.model = (function(){ 
  'use strict';
  var 
    configMap = {anon_id : 'a0'},
    stateMap = {
      anon_user : null,
      cid_serial : 0,
      people_cid_map : {},
      people_db : TAFFY(),
      user : null
    },
    isFakeData = true,
    personProto, makeCid, clearPeopleDb, completeLogin,
    makePerson, removePerson, people, chat, initModule;
  
 
  
  personProto = {
    get_is_user : function (){
      return this.cid === stateMap.user.cid;
    },
    get_is_anon:function(){
      return this.cid === stateMap.anon_user.cid;
    }
  };

  makeCid = function(){
    return 'c' + String( stateMap.cid_serial ++);  
  };
  
  clearPeopleDb = function (){
    var user = stateMp.user;
    stateMap.people_db = TAFFY();
    stateMap.people_cid_map = {};
    if(user) {
      stateMap.people_db.insert(user);
      stateMap.people_cid_map[user.cid] = user;
    }
  };
  
  completeLogin = function (user_list){
    var user_map = user_list[0];
    delete stateMap.people_cid_map[user_map.cid];
    stateMap.user.cid = user_map._id;
    stateMap.user.id = user_map._id;
    stateMap.user.css_map = user_map.css_map;
    stateMap.people_cid_map[user_map._id] = stateMap.user;
    
    //When we add chat, we should join here
    $.gevent.publish('spa-login', [stateMap.user]);
  };
  
  makePerson = function (person_map){
    var person,
      cid = person_map.cid,
      css_map = person_map.css_map,
      id = person_map.id,
      name = person_map.name;
      
      if(cid === undefined || !name){
        throw 'client id and name required';
      }
      
      person = Object.create(personProto);
      person.cid = cid;
      person.name = name;
      person.css_map = css_map;
      
      if(id) {person.id = id;}
      
      stateMap.people_cid_map[cid] = person;
      stateMap.people_db.insert(person);
      return person;
  };
  
  removePerson = function(person) {
    if(!person){return false;}
    //can't remove anonymous person
    if(person.id === configMap.anon_id){
      return false;
    }
    
    stateMap.people_db({cid : person.cid}).remove();
    if(person.cid){
      delete stateMap.people_cid_map[person.cid];
    }
    return true;
  };
  
 //The people object API
  // *get_user() - return the current user person object
  // *get_db() - return the TaffyDB database of all the person objects
  // *get_by_cid(<client_id>) - return a person object with provided unique id.
  // *login ( <user_name> ) - login as the user with the provided user name
  // *logout() - revert the current user object to anonymous
  //
  //jQuery global custom events published by the object include :
  // *spa-login - This is published when a user login process completes.
  // *spa-logout This published when a logout completes.
  //
  // Each person is represented by a person object.
  // Person objects provide the following methods:
  // *get_is_user() - return true if object is the current user;
  // *get_is_anon() - return true if object is anonymous
  //
  // The attributes for a person object include:
  // *cid - string client id.
  // *id - the unique id.
  // *name - the string name of the user.
  // *css_map - a map of attributes used for avatar presentation
  
  people = (function() {
    
    var get_by_cid, get_db, get_user, login, logout;
    
    get_by_cid = function (cid) {
      return stateMap.people_cid_map[cid];
    };
    
    get_db = function (){ return stateMap.people_db;};
    
    get_user = function (){ return stateMap.user;};
    
    login = function(name){
      var sio = isFakeData ? spa.fake.mockSio : spa.data.getSio();
      
      stateMap.user = makePerson({
        cid : makeCid(),
        css_map : {top : 25, left:25, 'background-color':'#8f8'},
        name : name
      });
      
      sio.on('userupdate', completeLogin);
      
      sio.emit('adduser', {
        cid : stateMap.user.cid,
        css_map : stateMap.user.css_map,
        name : stateMap.user.name
      });
    };
    
    logout = function(){
      var is_removed, user = stateMap.user;
      //when we add chat, we should leave the chatroom here
      
      is_removed = removePerson(user);
      stateMap.user = stateMap.anon_user;
      
      $.gevent.publish('spa-logout', [user]);
      return is_removed;
    };

    return {
      get_by_cid: get_by_cid,
      get_db: get_db,
      get_user: get_user,
      login: login,
      logout: logout
    };
  }());
  
  // The Chat object API
  // * join() - joins the chat room. Thsi routine sets up the chat protocol 
  // with the backend including publishers for 'spa-listchange' and 
  // 'spa-updatechat' global custom events. If the current user is anonymous, 
  // join() aborts and returns false.
  // * get_chatee() - return the person object with whom the user is chatting
  // * send_msg( <msg_text> )
  // * update_avatar ( <update_avtr_map> ) the update_avtr_map must have the
  // form {person_id : person_id, css_map : css_map}
  // jQuery global custom events published by the object include:
  //* spa-setchatee. A map of the form:
  // {old_chatee : <old_chatee_erspon_object>,
  //  new_chatee : <new_chatee_person_object>
  // }
  // *spa-listchange - this is published when the list of online people changes in length.
  // *spa-updatechat - this is published when a new message is received or sent:
  // { dest_id : <hatee_id>,
  //   dest_name : <chatee_name>,
  //   sender_id : <sender_id>,
  //   msg_text : <message_ontent>
  // 
  initModule = function (){
    var i, people_list, person_map;
    
    //initialize anonymous person
    stateMap.anon_user = makePerson({
      cid : configMap.anon_id,
      id : configMap.anon_id,
      name : 'anonymous'
    });
    stateMap.user = stateMap.anon_user;
    
    if(isFakeData) {
      people_list = spa.fake.getPeopleList();
      for (i = 0; i < people_list.length; i ++) {
        person_map = people_list[i];
        makePerson({
          cid : person_map._id,
          css_map : person_map.css_map,
          id : person_map._id,
          name : person_map.name
        });
      }
    }
  };

  return {
    initModule : initModule,
    people : people
  };
} () );
