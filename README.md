# Interacting particle system and BUNCH algorithm

Code for the BUNCH algorithm described in the article [Defining and finding lifelike entities with a lazy filter](https://arxiv.org/abs/2504.14774).

This interacting particle system was developed starting from [Particle Life](https://hunar4321.github.io/particle-life/particle_life.html), a loose replica of Jeffrey Ventrella’s Clusters algorithm. 

Both JavaScript (jsRacemi) and C++ (src) implementations build on Particle Life code and include a simple graphical user interface for tweaking the physics and visualization of the simulation. The JavaScript version additionally includes online plots for monitoring statistics by means of the open source library Plotly (v2.20.0).
The C++ version stands on the open source image rendering library openFrameworks (v0.12.0) and enables simulating a larger number of particles and  isualizations of the matrix of interaction force coefficients. 

To compile the C++ code, download the code and openFrameworks (https://openframeworks.cc/). Then generate a new openFrameworks project, add the addon ofxGui; after the project files are generated replace the /src folder with the one provided on GitHub. At the time of publication, the GUI slider that sets the number of atoms does not allow decreasing it. 
Compilation requires having the library [Eigen](https://libeigen.gitlab.io/eigen/docs-nightly/GettingStarted.html) in /src.

The wp* txt files were written by the C++ program for data analysis.

