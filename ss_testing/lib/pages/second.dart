import "package:flutter/material.dart";

class Second extends StatelessWidget {
  const Second ({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
      backgroundColor: Colors.greenAccent[400],
      title: Text("Second Page"),
      centerTitle: true,
      automaticallyImplyLeading: false,
     ),

     body: ElevatedButton(
      onPressed: () {
        Navigator.pop(context);
      },
      child: Text("To Home")
     ),
    );
  }
}