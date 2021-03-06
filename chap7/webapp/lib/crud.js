/**
 * Created by kenthuang on 15/7/15.
 */
/*jslint    node : true, continue: true,
 devel : true, indent : 2, maxerr : 50,
 newcap : true, nomen : true, plusplus : true,
 regexp : true, sloppy : true, vars : false,
 white : true
 */

/* global */

//--------------------------Begin Module scope variables
'use strict';
var
  loadSchema, checkSchema, clearIsOnline,
  checkType, constructObj,readObj,
  updateObj,destroyObj,
  mongodb = require('mongodb'),
  fsHandle = require('fs'),
  JSV = require('JSV').JSV,
  mongoServer = new mongodb.Server(
    'localhost',
    27017
  ),
  dbHandle = new mongodb.Db(
    'spa',mongoServer,{w:1}
  ),
  validator = JSV.createEnvironment(),
  makeMongoId = mongodb.ObjectID,
  objTypeMap = {'user':{}};

//--------------------------End Module scope variables

//--------------------------Begin Utility methods
loadSchema = function(schema_name, schema_path){
  fsHandle.readFile(schema_path, 'utf8', function(error, data){
    objTypeMap[schema_name] = JSON.parse(data);
  });
};

checkSchema = function(obj_type, obj_map, callback){
  var schema_map = objTypeMap[obj_type],
    report_map = validator.validate(obj_map, schema_map);

  callback(report_map.errors);
};

clearIsOnline = function(){
  updateObj(
    'user',
    {is_online: true},
    {is_online: false},
    function(response_map){
      console.log('All users set to offline', response_map);
    }
  );
};
//--------------------------End Utility methods

//--------------------------Begin public methods
checkType = function(obj_type){
  if(!objTypeMap[obj_type]){
    return({error_msg : 'Object type "' + obj_type
    + '" is not supported.'
    });
  }
  return null;
};

constructObj = function(obj_type, obj_map, callback){
  var type_check_map = checkType(obj_type);
  if(type_check_map){
    callback(type_check_map);
    return;
  }

  checkSchema(obj_type,obj_map,
    function(error_list){
      if(error_list.length === 0){
        dbHandle.collection(
          obj_type,
          function(outer_error, collection){
            var options_map = {safe:true};
            collection.insert(
              obj_map,
              options_map,
              function(inner_error, result){
                callback(result.ops);
              }
            );
          }
        );
      }
      else{
        callback({
          error_msg: 'Input document not valid',
          error_list: error_list
        });
      }
    });

};

readObj = function(obj_type, find_map, fields_map, callback){
  var type_check_map = checkType(obj_type);
  if(type_check_map){
    callback(type_check_map);
    return;
  }

  dbHandle.collection(
    obj_type,
    function(outer_error, collection){
      collection.find(find_map,fields_map).toArray(
        function(inner_error, map_list){
          callback(map_list);
        }
      );
    }
  );
};

updateObj = function(obj_type, find_map, set_map, callback){
  var type_check_map = checkType(obj_type);
  if(type_check_map){
    callback(type_check_map);
    return;
  }

  checkSchema(
    obj_type,set_map,
    function(error_list){
      if(error_list.length === 0){
        dbHandle.collection(
          obj_type,
          function(outer_error, collection){
            collection.update(
              find_map,
              {$set: set_map},
              {safe:true, multi:true, updsert:false},
              function(inner_error, update_count){
                callback({update_count : update_count});
              }
            );
          }
        );
      }
      else{
        callback({
          error_msg : 'Input document not valid',
          error_list: errorlist
        });
      }
    }
  );

};
destroyObj = function(obj_type, find_map, callback){
  var type_check_map = checkType(obj_type);
  if(type_check_map){
    callback(type_check_map);
    return;
  }

  dbHandle.collection(
    obj_type,
    function(outer_error, collection){
      var options_map = {safe:true, single: true};

      collection.remove(
        find_map,
        options_map,
        function(inner_error, delete_count){
          callback({delete_ccount: delete_count});
        }
      );
    }
  );
};

module.exports = {
  makeMongoId : mongodb.ObjectID,
  checkType : checkType,
  construct : constructObj,
  read : readObj,
  update : updateObj,
  destroy : destroyObj
};
//--------------------------End public methods

//--------------------------Begin module initialization
dbHandle.open(function(){
  console.log('** Connected to MongoDB **');
  clearIsOnline();
});

//load schemas into memory (objTypeMap)
var schema_name, schema_path;
for (schema_name in objTypeMap){
  if(objTypeMap.hasOwnProperty(schema_name)){
    schema_path = __dirname + '/' + schema_name + '.json';
    loadSchema(schema_name, schema_path);
  }
}

//--------------------------End module initialization