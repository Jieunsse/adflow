package ai.adflow.api.store.relaunch;

import ai.adflow.api.store.StoreController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/stores/auto-relaunch")
public class AutoRelaunchController extends StoreController<AutoRelaunchState> {

  public AutoRelaunchController(AutoRelaunchStateRepository repository) {
    super(repository);
  }
}
