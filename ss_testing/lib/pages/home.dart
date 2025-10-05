import "package:flutter/material.dart";

class Home extends StatelessWidget {
  const Home ({super.key});

  @override
  Widget build(BuildContext context) {    
    return Scaffold(
     appBar: AppBar(
      backgroundColor: Colors.greenAccent[400],
      title: Text("Home Page"),
      centerTitle: true,
      automaticallyImplyLeading: false,
     ),

     body: CounterState(
      count: 3,
       child: Column(
         children: [
           ElevatedButton(
            onPressed: () {
              Navigator.pushNamed(context, '/second');
            },
            child: Builder(
              builder: (BuildContext innerContext) {
                return Center(
                  child: Text("${CounterState.of(innerContext).count}"),
                );
              },
            )
           ),
         ],
       ),
     ), 
    );
  }
}

class CounterState extends InheritedWidget {
  const CounterState({
    super.key,
    required this.count,
    required super.child,
  });

  @override
  final int count;

  static CounterState of(BuildContext context) {
    return context.dependOnInheritedWidgetOfExactType<CounterState>()!;
  }

  @override
  bool updateShouldNotify(CounterState oldWidget) => count != oldWidget.count;
}


