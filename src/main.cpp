
#include "ofMain.h"
#include "ofApp.h"


int main( ){
	ofSetupOpenGL(800, 600, OF_WINDOW);
	
	//ofGLWindowSettings s;
	//s.setGLVersion(4, 3);
	//s.setSize(1600, 900);
	//s.setPosition(glm::vec2(0, 0));
	//ofCreateWindow(s);

	ofSetLogLevel(OF_LOG_NOTICE); // default
	//ofSetLogLevel(OF_LOG_VERBOSE);

	ofApp* ofwap = new ofApp();
	ofRunApp(ofwap);


}
