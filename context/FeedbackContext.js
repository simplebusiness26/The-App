import React,{createContext,useContext,useEffect,useRef,useState} from "react";
import {View,Text,Pressable,StyleSheet,Alert,Platform} from "react-native";

const FeedbackContext=createContext(null);

function installWebAlertFallback(showDialog){
  if(Platform.OS!=="web"){
    return()=>{};
  }

  const originalAlert=Alert.alert;

  Alert.alert=(title,message,buttons,options)=>{
    const actions=Array.isArray(buttons) && buttons.length
      ? buttons
      : [{text:"OK"}];

    showDialog({
      title:title || "Confirm action",
      message:message || "",
      buttons:actions,
      cancelable:options?.cancelable!==false
    });
  };

  return()=>{
    Alert.alert=originalAlert;
  };
}

export function FeedbackProvider({children}){
  const [notice,setNotice]=useState(null);
  const [dialog,setDialog]=useState(null);
  const timerRef=useRef(null);

  useEffect(()=>{
    const removeWebAlertFallback=installWebAlertFallback(setDialog);

    return()=>{
      removeWebAlertFallback();
      if(timerRef.current) clearTimeout(timerRef.current);
    };
  },[]);

  function clearFeedback(){
    if(timerRef.current){
      clearTimeout(timerRef.current);
      timerRef.current=null;
    }
    setNotice(null);
  }

  function showFeedback(message,type="success",title){
    if(timerRef.current) clearTimeout(timerRef.current);

    const defaultTitle=type==="error"
      ? "Something went wrong"
      : type==="info"
        ? "Update"
        : "Change confirmed";

    setNotice({message,type,title:title || defaultTitle});
    timerRef.current=setTimeout(()=>{
      setNotice(null);
      timerRef.current=null;
    },4500);
  }

  function closeDialog(){
    setDialog(null);
  }

  function runDialogAction(action){
    setDialog(null);
    action?.onPress?.();
  }

  return(
    <FeedbackContext.Provider value={{showFeedback,clearFeedback}}>
      <View style={styles.app}>
        {children}

        {!!notice && (
          <View
            accessibilityRole="alert"
            style={[
              styles.banner,
              notice.type==="error"
                ? styles.errorBanner
                : notice.type==="info"
                  ? styles.infoBanner
                  : styles.successBanner
            ]}
          >
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>
                {notice.type==="error" ? "!" : notice.type==="info" ? "i" : "✓"}
              </Text>
            </View>

            <View style={styles.textWrap}>
              <Text style={styles.title}>{notice.title}</Text>
              <Text style={styles.message}>{notice.message}</Text>
            </View>

            <Pressable
              accessibilityLabel="Dismiss confirmation"
              style={styles.closeButton}
              onPress={clearFeedback}
            >
              <Text style={styles.closeText}>×</Text>
            </Pressable>
          </View>
        )}

        {!!dialog && (
          <View style={styles.dialogOverlay}>
            <Pressable
              style={styles.dialogBackdrop}
              onPress={dialog.cancelable ? closeDialog : undefined}
            />

            <View
              accessibilityRole="alert"
              style={styles.dialogCard}
            >
              <Text style={styles.dialogTitle}>{dialog.title}</Text>
              {!!dialog.message && (
                <Text style={styles.dialogMessage}>{dialog.message}</Text>
              )}

              <View style={styles.dialogButtons}>
                {dialog.buttons.map((action,index)=>{
                  const destructive=action.style==="destructive";
                  const cancel=action.style==="cancel";

                  return(
                    <Pressable
                      key={`${action.text || "Action"}-${index}`}
                      // The buttons in this dialog were the only controls in
                      // the app with no role and no label, so a screen reader
                      // met a confirmation it could not answer.
                      accessibilityRole="button"
                      accessibilityLabel={action.text || "OK"}
                      style={[
                        styles.dialogButton,
                        destructive
                          ? styles.destructiveButton
                          : cancel
                            ? styles.cancelButton
                            : styles.confirmButton
                      ]}
                      onPress={()=>runDialogAction(action)}
                    >
                      <Text style={[
                        styles.dialogButtonText,
                        cancel && styles.cancelButtonText
                      ]}>
                        {action.text || "OK"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </View>
    </FeedbackContext.Provider>
  );
}

export function useFeedback(){
  const value=useContext(FeedbackContext);

  if(!value){
    throw new Error("useFeedback must be used inside FeedbackProvider");
  }

  return value;
}

const styles=StyleSheet.create({
  app:{flex:1},
  banner:{
    position:"absolute",
    top:76,
    left:12,
    right:12,
    zIndex:9999,
    elevation:20,
    borderRadius:14,
    borderWidth:1,
    padding:14,
    flexDirection:"row",
    alignItems:"center",
    shadowColor:"#000",
    shadowOpacity:0.18,
    shadowRadius:10,
    shadowOffset:{width:0,height:4}
  },
  successBanner:{backgroundColor:"#e8f7ed",borderColor:"#91c9a1"},
  errorBanner:{backgroundColor:"#fdebea",borderColor:"#e5a29e"},
  infoBanner:{backgroundColor:"#eaf1ff",borderColor:"#9db8ed"},
  iconWrap:{
    width:32,
    height:32,
    borderRadius:16,
    backgroundColor:"rgba(255,255,255,0.75)",
    alignItems:"center",
    justifyContent:"center"
  },
  icon:{fontSize:18,fontWeight:"bold"},
  textWrap:{flex:1,marginLeft:11},
  title:{fontSize:16,fontWeight:"bold",color:"#1f2933"},
  message:{fontSize:14,color:"#34404a",marginTop:3,lineHeight:19},
  closeButton:{paddingHorizontal:8,paddingVertical:4},
  closeText:{fontSize:26,lineHeight:27,color:"#34404a"},
  dialogOverlay:{
    ...StyleSheet.absoluteFillObject,
    zIndex:20000,
    elevation:40,
    alignItems:"center",
    justifyContent:"center",
    padding:22
  },
  dialogBackdrop:{
    ...StyleSheet.absoluteFillObject,
    backgroundColor:"rgba(0,0,0,0.62)"
  },
  dialogCard:{
    width:"100%",
    maxWidth:430,
    backgroundColor:"white",
    borderRadius:18,
    padding:22,
    shadowColor:"#000",
    shadowOpacity:0.28,
    shadowRadius:18,
    shadowOffset:{width:0,height:8}
  },
  dialogTitle:{fontSize:22,fontWeight:"bold",color:"#171717"},
  dialogMessage:{fontSize:16,color:"#4b5563",lineHeight:23,marginTop:10},
  dialogButtons:{flexDirection:"row",gap:10,marginTop:22},
  dialogButton:{flex:1,paddingVertical:14,paddingHorizontal:12,borderRadius:11},
  confirmButton:{backgroundColor:"#275bd6"},
  destructiveButton:{backgroundColor:"#b42318"},
  cancelButton:{backgroundColor:"#f2f3f5",borderWidth:1,borderColor:"#d4d7dc"},
  dialogButtonText:{color:"white",fontWeight:"bold",fontSize:15,textAlign:"center"},
  cancelButtonText:{color:"#222"}
});
